import REGL from 'regl';

import type { Corpus } from '../corpus';

export class AtlasVizRegl {
  constructor(canvas: HTMLCanvasElement, corpus: Corpus) {
    const regl = REGL({
      canvas,
      pixelRatio: window.devicePixelRatio || 1,
      attributes: { antialias: true, stencil: false, alpha: true, premultipliedAlpha: false, depth: false },
    });

    const points: Props[] = [
      { position: [0.0, 0.0], radius: 100, color: [0, 1, 0, 1] },
      { position: [-0.5, -0.5], radius: 100, color: [0, 1, 0, 1] },
      { position: [-0.5, 0.5], radius: 100, color: [0, 1, 0, 1] },
      { position: [0.5, -0.5], radius: 100, color: [0, 1, 0, 1] },
      { position: [0.5, 0.5], radius: 100, color: [0, 1, 0, 1] },
    ];

    interface Props {
      position: REGL.Vec2;
      radius: number;
      color: REGL.Vec4;
    }

    interface Uniforms {
      color: REGL.Vec4;
      radius: number;
      transformMatrix: REGL.Mat3;
    }

    interface Attributes {
      position: REGL.Vec2;
    }

    let zoom = 0.2;
    const pan = [-0.5, 0];

    // Zoom centered on the mouse position so that cursor remains at the same point in the world
    const handleWheel = (e: WheelEvent) => {
      const zoomIntensity = 0.1;
      const deltaZoom = e.deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity;

      // Compute new zoom level
      const newZoom = zoom * deltaZoom;

      // Compute how much we need to adjust the pan offsets to keep the cursor position constant in world coordinates
      // Get the mouse position in NDC
      const ndcX = (e.offsetX / canvas.width) * 2 - 1;
      const ndcY = -(e.offsetY / canvas.height) * 2 + 1; // Flip Y

      // Calculate the change in world coordinates under the cursor due to the zoom
      const worldXBefore = (ndcX - pan[0]) * zoom;
      const worldYBefore = (ndcY - pan[1]) * zoom;
      const worldXAfter = worldXBefore * deltaZoom;
      const worldYAfter = worldYBefore * deltaZoom;

      // Adjust pan offsets to account for the change in coordinates at the cursor
      pan[0] += (worldXBefore - worldXAfter) / newZoom;
      pan[1] += (worldYBefore - worldYAfter) / newZoom;

      // Set the new zoom
      zoom = newZoom;
    };

    canvas.addEventListener('wheel', handleWheel);

    const drawCircles = regl<Uniforms, Attributes, Props>({
      frag: `
        precision mediump float;

        uniform vec4 color;

        varying float vBorderWidth;
        varying float vBorderFade;

        void main() {
          float r = length(gl_PointCoord - vec2(0.5));

          float borderOuter = 0.5 - vBorderFade;
          float borderInner = borderOuter - vBorderWidth;

          float alpha = 1. - smoothstep(borderOuter, 0.5, r);
          alpha *= 0.94;

          if (alpha < 0.0001) {
            discard;
          }

          // inner part of the circle has reduced opacity
          alpha *= smoothstep(borderInner - vBorderFade, borderInner, r) * 0.65 + 0.35;

          gl_FragColor = vec4(color.rgb, alpha * color.a);
        }`,
      vert: `
        precision mediump float;

        attribute vec2 position;

        uniform float radius;
        uniform mat3 transformMatrix;

        varying float vBorderWidth;
        varying float vBorderFade;

        void main() {
          float scaledRadius = clamp(radius * length(transformMatrix[0].xy), 4., 500.);
          gl_PointSize = scaledRadius;
          vec3 ndc = transformMatrix * vec3(position, 1.0);
          gl_Position = vec4(ndc.xy, 0., 1.);

          // relative border width gets smaller as the circle gets larger
          float borderWidthFactor = 1. - smoothstep(10., 130., scaledRadius);
          vBorderWidth = 0.003 + 0.1 * borderWidthFactor;

          // border fade region gets smaller as the circle gets larger since it's a relative factor
          float borderFadeActivation = 1. - smoothstep(50., 500., scaledRadius);
          vBorderFade = 0.002 + 0.02 * borderFadeActivation;
        }`,
      attributes: {
        position: regl.prop<Props, 'position'>('position'),
      },
      uniforms: {
        color: regl.prop<Props, 'color'>('color'),
        radius: regl.prop<Props, 'radius'>('radius'),
        transformMatrix: ({ viewportWidth, viewportHeight }) => {
          const aspectRatio = viewportWidth / viewportHeight;

          type Mat3 = [number, number, number, number, number, number, number, number, number];
          const multiplyMatrices = (a: Mat3, b: Mat3) => {
            return [
              a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
              a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
              a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
              a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
              a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
              a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
              a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
              a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
              a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
            ];
          };

          const sX = aspectRatio > 1 ? 1 : 1 / aspectRatio;
          const sY = aspectRatio > 1 ? aspectRatio : 1;
          const scaleMatrix: Mat3 = [zoom * sX, 0, 0, 0, zoom * sY, 0, 0, 0, 1];

          const translateMatrix: Mat3 = [1, 0, 0, 0, 1, 0, pan[0], pan[1], 1];

          return multiplyMatrices(scaleMatrix, translateMatrix) as Mat3;
        },
      },
      count: 1,
      primitive: 'points',
      depth: { enable: false },
      blend: {
        enable: true,
        func: {
          srcRGB: 'src alpha',
          dstRGB: 'one minus src alpha',
          srcAlpha: 'one minus dst alpha',
          dstAlpha: 'one',
        },
      },
    });

    regl.frame(() => {
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1,
      });

      drawCircles(points);
    });
  }
}
