import { mat3, vec2 } from 'gl-matrix';
import REGL from 'regl';

import circleFragShader from './shaders/circle.frag';
import circleVertShader from './shaders/circle.vert';

export class AtlasVizRegl {
  constructor(canvas: HTMLCanvasElement) {
    const regl = REGL({
      canvas,
      pixelRatio: window.devicePixelRatio || 1,
      attributes: { antialias: true, stencil: false, alpha: true, premultipliedAlpha: false, depth: false },
    });

    const points: { position: REGL.Vec2; radius: number; color: REGL.Vec4 }[] = [
      { position: [0.0, 0.0], radius: 100, color: [0, 1, 0, 1] },
      { position: [-0.5, -0.5], radius: 100, color: [0, 1, 0, 1] },
      { position: [-0.5, 0.5], radius: 100, color: [0, 1, 0, 1] },
      { position: [0.5, -0.5], radius: 100, color: [0, 1, 0, 1] },
      { position: [0.5, 0.5], radius: 100, color: [0, 1, 0, 1] },
    ];

    interface Props {
      positions: REGL.Buffer;
      radii: REGL.Buffer;
      colors: REGL.Buffer;
      count: number;
    }

    interface Uniforms {
      transformMatrix: mat3;
    }

    interface Attributes {
      position: REGL.Vec2;
      radius: number;
      color: REGL.Vec4;
    }

    const props: Props = {
      positions: regl.buffer({ data: points.map((p) => p.position), usage: 'static' }),
      radii: regl.buffer({ data: points.map((p) => p.radius), usage: 'static' }),
      colors: regl.buffer({ data: points.map((p) => p.color), usage: 'static' }),
      count: points.length,
    };

    // Set up initial transform matrix for the world coordinates to viewport coordinates from [-1, -1] (botton left) to [1, 1] (top right)
    //
    // The initial view spans from -5 to 5 in X with Y scaled to maintain aspect ratio.
    const transformMatrix = (() => {
      const aspectRatio = canvas.width / canvas.height;
      const initialSpanX = 10;
      const initialSpanY = initialSpanX / aspectRatio;
      const initialCenter = [-1, 0];
      const transformMatrix = mat3.create();
      mat3.fromScaling(transformMatrix, [2 / initialSpanX, 2 / initialSpanY]);
      mat3.translate(transformMatrix, transformMatrix, [-initialCenter[0], -initialCenter[1]]);
      return transformMatrix;
    })();

    // Convert mouse coordinates from [0, 0] to [viewportWidth, viewportHeight] to world coordinates
    const mouseToWorld = (x: number, y: number) => {
      const invertedMatrix = mat3.invert(mat3.create(), transformMatrix);
      const viewportX = (x / canvas.width) * 2 - 1;
      const viewportY = 1 - (y / canvas.height) * 2;

      return vec2.transformMat3(vec2.create(), [viewportX, viewportY], invertedMatrix);
    };

    // Zoom centered on the mouse position so that cursor remains at the same point in the world
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // First, figure out the mouse position in world coordinates
      const mouseWorldBefore = mouseToWorld(e.offsetX, e.offsetY);

      // Now, scale the transform matrix
      const zoomMagnitude = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50);
      const scale = Math.exp(-zoomMagnitude * 0.005);
      mat3.scale(transformMatrix, transformMatrix, [scale, scale]);

      // Finally, figure out the new mouse position in world coordinates
      const mouseWorldAfter = mouseToWorld(e.offsetX, e.offsetY);

      // Adjust the transform matrix so that the mouse position remains at the same point in the world
      mat3.translate(transformMatrix, transformMatrix, [
        mouseWorldAfter[0] - mouseWorldBefore[0],
        mouseWorldAfter[1] - mouseWorldBefore[1],
      ]);
    };

    const handleClick = (e: MouseEvent) => {
      // TODO
    };

    canvas.addEventListener('wheel', handleWheel);

    const drawCircles = regl<Uniforms, Attributes, Props>({
      vert: circleVertShader,
      frag: circleFragShader,
      attributes: {
        position: regl.prop<Props, 'positions'>('positions'),
        radius: regl.prop<Props, 'radii'>('radii'),
        color: regl.prop<Props, 'colors'>('colors'),
      },
      uniforms: {
        transformMatrix: () => transformMatrix,
      },
      count: regl.prop<Props, 'count'>('count'),
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

      drawCircles(props);
    });
  }
}
