import { glMatrix, mat3, vec2 } from 'gl-matrix';
import REGL from 'regl';

import { get } from 'svelte/store';
import { getHiscoreIDsForUser } from '../api';
import { GlobalCorpus, type Corpus } from '../corpus';
import { clamp } from '../util';
import { turboColormap } from './colormap';
import circleFragShader from './shaders/circle.frag';
import circleVertShader from './shaders/circle.vert';

interface Props {
  positions: REGL.Buffer;
  radii: REGL.Buffer;
  colors: REGL.Buffer;
  count: number;
  alphaMultipliers: REGL.Buffer;
}

interface Uniforms {
  transformMatrix: mat3;
  hoveredCirclePosition: vec2;
  selectedCirclePosition: vec2;
}

interface Attributes {
  position: REGL.Vec2;
  radius: number;
  color: REGL.Vec4;
  alphaMultiplier: number;
}

glMatrix.setMatrixArrayType(Array);

export class AtlasVizRegl {
  private props: Props;
  private regl: REGL.Regl;
  private inputCbs!: {
    pointerDown: (e: MouseEvent) => void;
    pointerUp: (e: MouseEvent) => void;
    mouseMove: (e: MouseEvent) => void;
    wheel: (e: WheelEvent) => void;
    windowResize: () => void;
  };
  private cancelGlobalCorpusSubscription: () => void;
  private frame: REGL.Cancellable;
  private canvas: HTMLCanvasElement;
  private canvasWidth = 1;
  private canvasHeight = 1;
  private corpus: Corpus | undefined;
  private curRadii: number[] = [];
  public transformMatrix: mat3;
  private highlightedScoreIDs: Set<string> | null = null;
  private hoveredScoreIx: number | null = null;
  private selectedScoreIx: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvasWidth = canvas.clientWidth;
    this.canvasHeight = canvas.clientHeight;

    const regl = REGL({
      canvas,
      pixelRatio: window.devicePixelRatio || 1,
      attributes: { antialias: true, stencil: false, alpha: true, premultipliedAlpha: false, depth: false },
    });

    this.props = {
      positions: regl.buffer([]),
      radii: regl.buffer([]),
      colors: regl.buffer([]),
      alphaMultipliers: regl.buffer([]),
      count: 0,
    };

    // Set up initial transform matrix for the world coordinates to viewport coordinates from [-1, -1] (botton left) to [1, 1] (top right)
    //
    // The initial view spans from -5 to 5 in X with Y scaled to maintain aspect ratio.
    this.transformMatrix = (() => {
      const aspectRatio = canvas.clientWidth / canvas.clientHeight;
      const initialSpanX = 10;
      const initialSpanY = initialSpanX / aspectRatio;
      const initialCenter = [0, 0];
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
        alphaMultiplier: regl.prop<Props, 'alphaMultipliers'>('alphaMultipliers'),
      },
      uniforms: {
        transformMatrix: () => this.transformMatrix,
        hoveredCirclePosition: () => {
          if (!this.corpus || this.hoveredScoreIx === null) {
            return [-1000, -1000];
          }
          return this.corpus[this.hoveredScoreIx].position;
        },
        selectedCirclePosition: () => {
          if (!this.corpus || this.selectedScoreIx === null) {
            return [-1000, -1000];
          }
          return this.corpus[this.selectedScoreIx].position;
        },
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

    this.updateData();

    this.cancelGlobalCorpusSubscription = GlobalCorpus.subscribe(() => this.updateData());

    getHiscoreIDsForUser(4093752).then((scoreIDs) => {
      this.highlightedScoreIDs = scoreIDs;
      this.updateData();
    });
  }

  private computePointRadius(numUsers: number): number {
    const baseRadius = Math.log(numUsers) * 7 + numUsers * 0.0016;
    const zoomLevel = Math.sqrt(
      this.transformMatrix[0] * this.transformMatrix[0] + this.transformMatrix[3] * this.transformMatrix[3]
    );
    const scaleFactor = Math.min(Math.max(zoomLevel, 0.14), 0.324);
    return Math.min(Math.max(baseRadius * scaleFactor, 4.2), 10000);
  }

  private updateRadii() {
    if (!this.corpus) {
      return;
    }
    this.curRadii = this.corpus.map((d) => this.computePointRadius(d.numUsers));
    this.props.radii = this.regl.buffer(this.curRadii);
  }

  private updateData() {
    const fetchedCorpus = get(GlobalCorpus);
    if (fetchedCorpus.status !== 'loaded') {
      return;
    }
    this.corpus = fetchedCorpus.data;

    this.props.positions.destroy();
    this.props.radii.destroy();
    this.props.colors.destroy();
    this.props.alphaMultipliers.destroy();

    // Sort the corpus by number of users so that smaller circles are drawn on top of larger circles
    this.corpus.sort((a, b) => b.numUsers - a.numUsers);

    this.props.count = this.corpus.length;
    this.props.positions = this.regl.buffer(this.corpus.map((d) => d.position));
    this.updateRadii();

    this.props.colors = this.regl.buffer(
      this.corpus.map((d) => {
        // scale from [minAvgPP, maxAvgPP] to [0, 1]
        const scaled = (d.averagePp - 50) / (630 - 50);
        return [...turboColormap(scaled), 1];
      })
    );

    // color by ratio between aim difficulty and speed difficulty
    let [minRatio, maxRatio] = this.corpus.reduce(
      ([min, max], d) => [
        Math.min(min, d.aimDifficulty / d.speedDifficulty),
        Math.max(max, d.aimDifficulty / d.speedDifficulty),
      ],
      [Infinity, -Infinity]
    );
    minRatio = clamp(minRatio, 0.85, 1.6);
    maxRatio = clamp(maxRatio, 0.85, 1.6);
    // this.props.colors = this.regl.buffer(
    //   this.corpus.map((d) => {
    //     // scale from [minRatio, maxRatio] to [0, 1]
    //     const ratio = clamp(d.aimDifficulty / d.speedDifficulty, minRatio, maxRatio);
    //     const scaled = (ratio - minRatio) / (maxRatio - minRatio);
    //     return [...turboColormap(scaled), 1];
    //   })
    // );

    // color by release year
    const [minYear, maxYear] = this.corpus.reduce(
      ([min, max], d) => [Math.min(min, d.releaseYear), Math.max(max, d.releaseYear)],
      [Infinity, -Infinity]
    );
    // this.props.colors = this.regl.buffer(
    //   corpus.map((d) => {
    //     // scale from [minYear, maxYear] to [0, 1]
    //     const scaled = (d.releaseYear - minYear) / (maxYear - minYear);
    //     return [...turboColormap(scaled), 1];
    //   })
    // );

    const highlightedScoreIDs = this.highlightedScoreIDs;
    const baseAlphaMultiplier = 0.94;
    const alphaMultipliers = highlightedScoreIDs
      ? this.corpus.map((d) => (highlightedScoreIDs.has(d.scoreID) ? baseAlphaMultiplier : 0.28))
      : new Float32Array(this.corpus.length).fill(baseAlphaMultiplier);
    this.props.alphaMultipliers = this.regl.buffer(alphaMultipliers);
  }

  private mouseToWorld = (x: number, y: number): vec2 => {
    const invertedMatrix = mat3.invert(mat3.create(), this.transformMatrix);
    const viewportX = (x / this.canvasWidth) * 2 - 1;
    const viewportY = 1 - (y / this.canvasHeight) * 2;

    return vec2.transformMat3(vec2.create(), [viewportX, viewportY], invertedMatrix);
  };

  /**
   * inverse of `mouseToWorld`
   */
  private worldToMouse = (worldX: number, worldY: number): vec2 => {
    const viewportPos = vec2.transformMat3(vec2.create(), [worldX, worldY], this.transformMatrix);
    const x = ((viewportPos[0] + 1) / 2) * this.canvasWidth;
    const y = ((1 - viewportPos[1]) / 2) * this.canvasHeight;
    return [x, y];
  };

  /**
   *
   * @returns the index of the score that is being hovered over, or null if no score is being hovered over
   */
  private hitTest(mouseX: number, mouseY: number): number | null {
    if (!this.corpus) {
      return null;
    }

    // first we compute the viewport bounds in world space to save some work
    const topLeftWorld = this.mouseToWorld(0, 0);
    const bottomRightWorld = this.mouseToWorld(this.canvasWidth, this.canvasHeight);
    // add 50% padding to the viewport bounds
    const viewportBoundsWorld = [
      [
        topLeftWorld[0] - (bottomRightWorld[0] - topLeftWorld[0]) / 2,
        topLeftWorld[1] + (topLeftWorld[1] - bottomRightWorld[1]) / 2,
      ],
      [
        bottomRightWorld[0] + (bottomRightWorld[0] - topLeftWorld[0]) / 2,
        bottomRightWorld[1] - (topLeftWorld[1] - bottomRightWorld[1]) / 2,
      ],
    ];
    const minX = Math.min(viewportBoundsWorld[0][0], viewportBoundsWorld[1][0]);
    const maxX = Math.max(viewportBoundsWorld[0][0], viewportBoundsWorld[1][0]);
    const minY = Math.min(viewportBoundsWorld[0][1], viewportBoundsWorld[1][1]);
    const maxY = Math.max(viewportBoundsWorld[0][1], viewportBoundsWorld[1][1]);

    // brute force for now to see how perf is
    //
    // search back to front since smaller circles are drawn on top of larger circles
    for (let i = this.corpus.length - 1; i >= 0; i--) {
      const d = this.corpus[i];
      const topLeftWorld = d.position;
      if (topLeftWorld[0] < minX || topLeftWorld[0] > maxX || topLeftWorld[1] < minY || topLeftWorld[1] > maxY) {
        continue;
      }

      const centerPixels = this.worldToMouse(topLeftWorld[0], topLeftWorld[1]);
      const radiusPixels = this.curRadii[i] / 2;

      const dist = Math.hypot(centerPixels[0] - mouseX, centerPixels[1] - mouseY);
      if (dist <= radiusPixels) {
        return i;
      }
    }

    return null;
  }

  private setupInputHandlers() {
    // Convert mouse coordinates from [0, 0] to [viewportWidth, viewportHeight] to world coordinates

    /**
     * Zoom centered on the mouse position so that cursor remains at the same point in the world after zooming
     */
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const mouseWorldBefore = this.mouseToWorld(e.offsetX, e.offsetY);

      const zoomMagnitude = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50);
      const scale = Math.exp(-zoomMagnitude * 0.003);
      mat3.scale(this.transformMatrix, this.transformMatrix, [scale, scale]);

      const mouseWorldAfter = this.mouseToWorld(e.offsetX, e.offsetY);

      mat3.translate(this.transformMatrix, this.transformMatrix, [
        mouseWorldAfter[0] - mouseWorldBefore[0],
        mouseWorldAfter[1] - mouseWorldBefore[1],
      ]);
      console.log(this.transformMatrix[0], this.transformMatrix[3]);

      this.updateRadii();
    };

    // TODO: Implement pinch-to-zoom for mobile

    let dragData: { startWorldCoord: vec2 } | null = null;
    const handlePointerDown = (e: MouseEvent) => {
      dragData = {
        startWorldCoord: this.mouseToWorld(e.offsetX, e.offsetY),
      };

      this.selectedScoreIx = this.hitTest(e.offsetX, e.offsetY);
    };

    const handlePointerUp = (e: MouseEvent) => {
      dragData = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragData) {
        const mouseWorldBefore = dragData.startWorldCoord;
        const mouseWorldAfter = this.mouseToWorld(e.offsetX, e.offsetY);

        // translate to keep the same point in the world under the cursor
        mat3.translate(this.transformMatrix, this.transformMatrix, [
          mouseWorldAfter[0] - mouseWorldBefore[0],
          mouseWorldAfter[1] - mouseWorldBefore[1],
        ]);
      }

      const oldHoveredScoreIx = this.hoveredScoreIx;
      this.hoveredScoreIx = this.hitTest(e.offsetX, e.offsetY);
      if ((oldHoveredScoreIx === null) !== (this.hoveredScoreIx === null)) {
        this.canvas.style.cursor = this.hoveredScoreIx === null ? 'default' : 'pointer';
      }
    };

    const handleWindowResize = () => {
      const newCanvasWidth = this.canvas.clientWidth;
      const newCanvasHeight = this.canvas.clientHeight;

      if (newCanvasWidth === this.canvasWidth && newCanvasHeight === this.canvasHeight) {
        return;
      }

      // keep current zoom level and center while adjusting aspect ratio
      const widthMultiplier = this.canvasWidth / newCanvasWidth;
      const heightMultiplier = this.canvasHeight / newCanvasHeight;
      mat3.scale(this.transformMatrix, this.transformMatrix, [widthMultiplier, heightMultiplier]);

      this.canvasWidth = newCanvasWidth;
      this.canvasHeight = newCanvasHeight;
    };

    this.inputCbs = {
      pointerDown: handlePointerDown,
      mouseMove: handleMouseMove,
      pointerUp: handlePointerUp,
      wheel: handleWheel,
      windowResize: handleWindowResize,
    };

    this.canvas.addEventListener('wheel', handleWheel);
    this.canvas.addEventListener('pointerdown', handlePointerDown);
    this.canvas.addEventListener('pointerup', handlePointerUp);
    this.canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleWindowResize);
  }

  public destroy() {
    this.cancelGlobalCorpusSubscription();
    this.frame.cancel();
    this.props.positions.destroy();
    this.props.radii.destroy();
    this.props.colors.destroy();
    this.props.alphaMultipliers.destroy();
    this.regl.destroy();
    this.regl._gl.getExtension('WEBGL_lose_context')?.loseContext();

    this.canvas.removeEventListener('wheel', this.inputCbs.wheel);
    this.canvas.removeEventListener('pointerdown', this.inputCbs.pointerDown);
    this.canvas.removeEventListener('mousemove', this.inputCbs.mouseMove);
    this.canvas.removeEventListener('pointerup', this.inputCbs.pointerUp);
    window.removeEventListener('resize', this.inputCbs.windowResize);
  }
}
