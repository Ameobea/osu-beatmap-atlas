import { mat3, vec2 } from 'gl-matrix';
import REGL from 'regl';

import { get } from 'svelte/store';
import { GlobalCorpus, type Corpus } from '../corpus';
import { turboColormap } from './colormap';
import circleFragShader from './shaders/circle.frag';
import circleVertShader from './shaders/circle.vert';

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

export class AtlasVizRegl {
  private props: Props;
  private regl: REGL.Regl;
  private inputCbs!: {
    mouseDown: (e: MouseEvent) => void;
    mouseUp: (e: MouseEvent) => void;
    mouseMove: (e: MouseEvent) => void;
    wheel: (e: WheelEvent) => void;
    windowResize: () => void;
  };
  private frame: REGL.Cancellable;
  private canvas: HTMLCanvasElement;
  public transformMatrix: mat3;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const regl = REGL({
      canvas,
      pixelRatio: window.devicePixelRatio || 1,
      attributes: { antialias: true, stencil: false, alpha: true, premultipliedAlpha: false, depth: false },
    });

    this.props = {
      positions: regl.buffer([]),
      radii: regl.buffer([]),
      colors: regl.buffer([]),
      count: 0,
    };

    // Set up initial transform matrix for the world coordinates to viewport coordinates from [-1, -1] (botton left) to [1, 1] (top right)
    //
    // The initial view spans from -5 to 5 in X with Y scaled to maintain aspect ratio.
    this.transformMatrix = (() => {
      const aspectRatio = canvas.clientWidth / canvas.clientHeight;
      const initialSpanX = 10;
      const initialSpanY = initialSpanX / aspectRatio;
      const initialCenter = [-1, 0];
      const transformMatrix = mat3.create();
      mat3.fromScaling(transformMatrix, [2 / initialSpanX, 2 / initialSpanY]);
      mat3.translate(transformMatrix, transformMatrix, [-initialCenter[0], -initialCenter[1]]);
      return transformMatrix;
    })();

    this.setupInputHandlers();

    const drawCircles = regl<Uniforms, Attributes, Props>({
      vert: circleVertShader,
      frag: circleFragShader,
      attributes: {
        position: regl.prop<Props, 'positions'>('positions'),
        radius: regl.prop<Props, 'radii'>('radii'),
        color: regl.prop<Props, 'colors'>('colors'),
      },
      uniforms: {
        transformMatrix: () => this.transformMatrix,
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

    this.frame = regl.frame(() => {
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1,
      });

      if (this.props.count === 0) {
        return;
      }

      drawCircles(this.props);
    });

    this.regl = regl;

    const fetchedCorpus = get(GlobalCorpus);
    if (fetchedCorpus.status === 'loaded') {
      this.updateData(fetchedCorpus.data);
    }

    GlobalCorpus.subscribe((fetchedCorpus) => {
      if (fetchedCorpus.status === 'loaded') {
        this.updateData(fetchedCorpus.data);
      }
    });
  }

  private updateData(corpus: Corpus) {
    this.props.positions.destroy();
    this.props.radii.destroy();
    this.props.colors.destroy();

    this.props.count = corpus.length;
    this.props.positions = this.regl.buffer(corpus.map((d) => d.position));
    this.props.radii = this.regl.buffer(corpus.map((d) => 6 + Math.log(d.numUsers) * 6 + d.numUsers * 0.001));

    const [minAvgPP, maxAvgPP] = corpus.reduce(
      ([min, max], d) => [Math.min(min, d.averagePp), Math.max(max, d.averagePp)],
      [Infinity, -Infinity]
    );
    this.props.colors = this.regl.buffer(
      corpus.map((d) => {
        // scale from [minAvgPP, maxAvgPP] to [0, 1]
        const scaled = (d.averagePp - minAvgPP) / (maxAvgPP - minAvgPP);
        return [...turboColormap(scaled), 1];
      })
    );
  }

  private setupInputHandlers() {
    // Convert mouse coordinates from [0, 0] to [viewportWidth, viewportHeight] to world coordinates
    const mouseToWorld = (x: number, y: number) => {
      const invertedMatrix = mat3.invert(mat3.create(), this.transformMatrix);
      const viewportX = (x / this.canvas.clientWidth) * 2 - 1;
      const viewportY = 1 - (y / this.canvas.clientHeight) * 2;

      return vec2.transformMat3(vec2.create(), [viewportX, viewportY], invertedMatrix);
    };

    /**
     * Zoom centered on the mouse position so that cursor remains at the same point in the world after zooming
     */
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const mouseWorldBefore = mouseToWorld(e.offsetX, e.offsetY);

      const zoomMagnitude = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50);
      const scale = Math.exp(-zoomMagnitude * 0.005);
      mat3.scale(this.transformMatrix, this.transformMatrix, [scale, scale]);

      const mouseWorldAfter = mouseToWorld(e.offsetX, e.offsetY);

      mat3.translate(this.transformMatrix, this.transformMatrix, [
        mouseWorldAfter[0] - mouseWorldBefore[0],
        mouseWorldAfter[1] - mouseWorldBefore[1],
      ]);
    };

    // TODO: Implement pinch-to-zoom for mobile

    let dragData: { startWorldCoord: vec2 } | null = null;
    const handleMouseDown = (e: MouseEvent) => {
      dragData = {
        startWorldCoord: mouseToWorld(e.offsetX, e.offsetY),
      };
    };

    const handleMouseUp = (e: MouseEvent) => {
      dragData = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragData) {
        return;
      }

      const mouseWorldBefore = dragData.startWorldCoord;
      const mouseWorldAfter = mouseToWorld(e.offsetX, e.offsetY);

      // translate to keep the same point in the world under the cursor
      mat3.translate(this.transformMatrix, this.transformMatrix, [
        mouseWorldAfter[0] - mouseWorldBefore[0],
        mouseWorldAfter[1] - mouseWorldBefore[1],
      ]);

      dragData.startWorldCoord = mouseWorldAfter;
    };

    let oldCanvasWidth = this.canvas.clientWidth;
    let oldCanvasHeight = this.canvas.clientHeight;
    const handleWindowResize = () => {
      const newCanvasWidth = this.canvas.clientWidth;
      const newCanvasHeight = this.canvas.clientHeight;

      if (newCanvasWidth === oldCanvasWidth && newCanvasHeight === oldCanvasHeight) {
        return;
      }

      // keep current zoom level and center while adjusting aspect ratio
      const widthMultiplier = oldCanvasWidth / newCanvasWidth;
      const heightMultiplier = oldCanvasHeight / newCanvasHeight;
      mat3.scale(this.transformMatrix, this.transformMatrix, [widthMultiplier, heightMultiplier]);

      oldCanvasWidth = newCanvasWidth;
      oldCanvasHeight = newCanvasHeight;
    };

    this.inputCbs = {
      mouseDown: handleMouseDown,
      mouseMove: handleMouseMove,
      mouseUp: handleMouseUp,
      wheel: handleWheel,
      windowResize: handleWindowResize,
    };

    this.canvas.addEventListener('wheel', handleWheel);
    this.canvas.addEventListener('mousedown', handleMouseDown);
    this.canvas.addEventListener('mouseup', handleMouseUp);
    this.canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleWindowResize);
  }

  public destroy() {
    this.frame.cancel();
    this.props.positions.destroy();
    this.props.radii.destroy();
    this.props.colors.destroy();
    this.regl.destroy();

    this.canvas.removeEventListener('wheel', this.inputCbs.wheel);
    this.canvas.removeEventListener('mousedown', this.inputCbs.mouseDown);
    this.canvas.removeEventListener('mousemove', this.inputCbs.mouseMove);
    window.removeEventListener('resize', this.inputCbs.windowResize);
  }
}
