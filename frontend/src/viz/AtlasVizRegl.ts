import { glMatrix, mat3, vec2 } from 'gl-matrix';
import REGL from 'regl';

import { ColorModeConfigs, type ColorMode } from '$lib';
import { get, writable, type Writable } from 'svelte/store';
import { getHiscoreIDsForUser, getUserID } from '../api';
import { buildColorLegend } from '../components/ColorLegend';
import { GlobalCorpus, type Corpus, type ScoreMetadata } from '../corpus';
import { UnreachableError, clamp, mix } from '../util';
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
  dpr: number;
}

interface Attributes {
  position: REGL.Vec2;
  radius: number;
  color: REGL.Vec3;
  alphaMultiplier: number;
}

glMatrix.setMatrixArrayType(Array);

export class AtlasVizRegl {
  private props: Props;
  private regl: REGL.Regl;
  private inputCbs!: {
    pointerDown: (evt: PointerEvent) => void;
    pointerUp: (evt: PointerEvent) => void;
    pointerMove: (evt: PointerEvent) => void;
    wheel: (evt: WheelEvent) => void;
    windowResize: () => void;
  };
  private cancelGlobalCorpusSubscription: () => void;
  private frame: REGL.Cancellable;
  private canvas: HTMLCanvasElement;
  private canvasWidth = 1;
  private canvasHeight = 1;
  private corpus: Corpus | undefined;
  cachedCorpusPositions: number[] = [];
  private curRadii: number[] = [];
  public transformMatrix: mat3;
  private highlightedScoreIDs: Set<string> | null = null;
  private hoveredScoreIx: number | null = null;
  public selectedScoreIx: Writable<number | null>;
  private activeUsername: Writable<string | null> = writable(null);
  private activeUserID: Writable<number | null>;
  private colorLegend: HTMLElement | null = null;
  private activeColorMode: ColorMode;

  constructor(
    canvas: HTMLCanvasElement,
    initialColorMode: ColorMode,
    selectedScoreIx: Writable<number | null>,
    activeUserID: Writable<number | null>,
    onCanvasClick: () => void,
    initialTransformMatrix?: mat3
  ) {
    this.canvas = canvas;
    this.activeColorMode = initialColorMode;
    this.selectedScoreIx = selectedScoreIx;
    this.activeUserID = activeUserID;
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
    this.transformMatrix =
      initialTransformMatrix ??
      (() => {
        const aspectRatio = canvas.clientWidth / canvas.clientHeight;
        const initialSpanX = 81.6;
        const initialSpanY = initialSpanX / aspectRatio;
        const initialCenter = [14.4, -8];
        const transformMatrix = mat3.create();
        mat3.fromScaling(transformMatrix, [2 / initialSpanX, 2 / initialSpanY]);
        mat3.translate(transformMatrix, transformMatrix, [-initialCenter[0], -initialCenter[1]]);
        return transformMatrix;
      })();

    this.setupInputHandlers(onCanvasClick);

    const dpr = window.devicePixelRatio || 1;
    // Leave circles slightly smaller on high-DPI screens since they can show extra detail
    const adjustedDPR = mix(dpr, 1, 0.25);

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
          const selectedScoreIx = get(this.selectedScoreIx);
          if (!this.corpus || selectedScoreIx === null) {
            return [-1000, -1000];
          }
          return this.corpus[selectedScoreIx].position;
        },
        dpr: adjustedDPR,
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

    this.cancelGlobalCorpusSubscription = GlobalCorpus.subscribe(() => this.updateData());

    const lastUserHiscoreIDs = localStorage.getItem('lastUserHiscoreIDs');
    if (lastUserHiscoreIDs) {
      this.highlightedScoreIDs = new Set(JSON.parse(lastUserHiscoreIDs));
    }
    this.updateData();

    const initialActiveUsername = localStorage.getItem('activeUsername');
    if (initialActiveUsername) {
      this.setActiveUsername(initialActiveUsername);
    }
  }

  public setColorMode(colorMode: ColorMode) {
    this.activeColorMode = colorMode;
    this.updateData();
  }

  private computePointRadius(dpr: number, selectedScoreIx: number | null, scoreIx: number): number {
    const numUsers = this.corpus![scoreIx].numUsers;
    const isHovered = this.hoveredScoreIx === scoreIx;
    const isSelected = selectedScoreIx === scoreIx;

    const baseRadius = 12 + Math.log(numUsers) * 9 + numUsers * 0.0016;
    const zoomLevel = this.transformMatrix[0];
    const scaleFactor = clamp(zoomLevel, 0.14, 0.324);
    let radius = Math.min(Math.max(baseRadius * scaleFactor, 4.2), 10000);
    if (isHovered && !isSelected) {
      radius += clamp(0.4 * radius, 8, 22);
    }
    if (isSelected) {
      radius += clamp(0.6 * radius, 12, 26);
    }
    return radius;
  }

  public setActiveUsername(username: string | null) {
    if (!username) {
      this.activeUsername.set(null);
      this.activeUserID.set(null);
      this.highlightedScoreIDs = null;
      this.updateData();
      return;
    }

    getUserID(username).then((userID) => {
      this.activeUserID.set(userID);
    });

    getHiscoreIDsForUser(username)
      .then((scoreIDs) => {
        this.activeUsername.set(username);
        localStorage.setItem('lastUserHiscoreIDs', JSON.stringify(Array.from(scoreIDs)));
        this.highlightedScoreIDs = scoreIDs;
        this.updateData();
      })
      .catch((err) => {
        console.error(`Failed to fetch hiscore IDs for user ${username}:`, err);
        alert(`Failed to fetch hiscores for user "${username}"; check spelling, punctuation, etc. and try again.`);
      });
  }

  private updateRadii() {
    if (!this.corpus) {
      return;
    }

    const oldLength = this.curRadii.length;
    const selectedScoreIx = get(this.selectedScoreIx);
    const dpr = window.devicePixelRatio || 1;
    this.curRadii = this.corpus.map((_d, i) => this.computePointRadius(dpr, selectedScoreIx, i));
    if (oldLength !== this.curRadii.length) {
      this.props.radii.destroy();
      this.props.radii = this.regl.buffer(this.curRadii);
    } else {
      this.props.radii.subdata(this.curRadii);
    }
  }

  private buildColorLegend() {
    const {
      explicitMinVal,
      explicitMaxVal,
      getValue,
      title,
      colorMapper = turboColormap,
      tickCount,
      tickFormat,
      tickValues,
    } = ColorModeConfigs[this.activeColorMode];
    const colorizeDatum = (d: ScoreMetadata) => {
      const scaled = (getValue(d) - minVal) / (maxVal - minVal);
      return colorMapper(scaled);
    };
    if (!this.corpus) {
      return colorizeDatum;
    }

    const [computedMinVal, computedMaxVal] = this.corpus.reduce(
      ([min, max], d) => [Math.min(min, getValue(d)), Math.max(max, getValue(d))],
      [Infinity, -Infinity]
    );
    const minVal = explicitMinVal ?? computedMinVal;
    const maxVal = explicitMaxVal ?? computedMaxVal;

    this.colorLegend?.remove();
    this.colorLegend = buildColorLegend(
      (n: number) => {
        const scaled = (n - minVal) / (maxVal - minVal);
        return colorMapper(scaled);
      },
      {
        heightPx: 32,
        widthPx: Math.min(340, this.canvas.clientWidth - 97),
        maxVal,
        minVal,
        title,
        tickCount,
        tickFormat,
        tickValues,
      }
    );
    this.canvas.parentElement?.appendChild(this.colorLegend);

    return colorizeDatum;
  }

  private updateData() {
    const fetchedCorpus = get(GlobalCorpus);
    if (fetchedCorpus.status !== 'loaded') {
      return;
    }
    this.corpus = fetchedCorpus.data;

    this.props.positions.destroy();
    this.props.colors.destroy();
    this.props.alphaMultipliers.destroy();

    // Sort the corpus to put highlighted scores first and then by number of users so that smaller
    // circles are drawn on top of larger circles
    const highlightedScoreIDs = this.highlightedScoreIDs;
    this.corpus.sort(
      highlightedScoreIDs
        ? (a, b) => {
            const aIsHighlighted = highlightedScoreIDs.has(a.scoreID);
            const bIsHighlighted = highlightedScoreIDs.has(b.scoreID);
            if (aIsHighlighted && !bIsHighlighted) {
              return 1;
            } else if (!aIsHighlighted && bIsHighlighted) {
              return -1;
            } else {
              return b.numUsers - a.numUsers;
            }
          }
        : (a, b) => b.numUsers - a.numUsers
    );
    this.cachedCorpusPositions = this.corpus.flatMap((d) => d.position);

    this.props.count = this.corpus.length;
    this.props.positions = this.regl.buffer(this.corpus.map((d) => d.position));
    this.updateRadii();

    const colorMapper = this.buildColorLegend();

    this.props.colors = this.regl.buffer(this.corpus.map(colorMapper));

    const baseAlphaMultiplier = highlightedScoreIDs?.size ? 1 : 0.628;
    const alphaMultipliers = highlightedScoreIDs
      ? this.corpus.map((d) => (highlightedScoreIDs.has(d.scoreID) ? baseAlphaMultiplier : 0.11))
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

    // brute force for now to see how perf is
    //
    // search back to front since smaller circles are drawn on top of larger circles
    for (let i = this.corpus.length - 1; i >= 0; i--) {
      const topLeftWorldX = this.cachedCorpusPositions[i * 2];
      const topLeftWorldY = this.cachedCorpusPositions[i * 2 + 1];

      const centerPixels = this.worldToMouse(topLeftWorldX, topLeftWorldY);
      const radiusPixels = this.curRadii[i] / 2;

      const dist = Math.hypot(centerPixels[0] - mouseX, centerPixels[1] - mouseY);
      if (dist <= radiusPixels) {
        return i;
      }
    }

    return null;
  }

  private updatePointSize(i: number) {
    const selectedScoreIx = get(this.selectedScoreIx);
    const dpr = window.devicePixelRatio || 1;
    const newRadius = this.computePointRadius(dpr, selectedScoreIx, i);
    this.curRadii[i] = newRadius;
    this.props.radii.subdata([newRadius], i * 4);
  }

  private setupInputHandlers(onCanvasClick: () => void) {
    // Convert mouse coordinates from [0, 0] to [viewportWidth, viewportHeight] to world coordinates

    /**
     * Zoom centered on the mouse position so that cursor remains at the same point in the world after zooming
     */
    const handleWheel = (evt: WheelEvent) => {
      evt.preventDefault();

      const mouseWorldBefore = this.mouseToWorld(evt.offsetX, evt.offsetY);

      const zoomMagnitude = Math.sign(evt.deltaY) * Math.min(Math.abs(evt.deltaY), 50);
      const scale = Math.exp(-zoomMagnitude * 0.003);
      mat3.scale(this.transformMatrix, this.transformMatrix, [scale, scale]);

      const mouseWorldAfter = this.mouseToWorld(evt.offsetX, evt.offsetY);

      mat3.translate(this.transformMatrix, this.transformMatrix, [
        mouseWorldAfter[0] - mouseWorldBefore[0],
        mouseWorldAfter[1] - mouseWorldBefore[1],
      ]);

      this.updateRadii();
    };

    // pointer tracking for mobile multi-touch
    const activePointersByID = new Map<number, { curMouseCoord: vec2 }>();

    interface PinchZoomData {
      lastDistancePixels: number;
      lastMidpointWorld: vec2;
    }

    let dragData: { startWorldCoord: vec2; startMouseCoord: vec2; pinchZoomData?: PinchZoomData } | null = null;
    const handlePointerDown = (evt: PointerEvent) => {
      evt.preventDefault();
      (document.activeElement as any)?.blur();

      onCanvasClick();

      if (activePointersByID.size === 2) {
        // ignore additional pointers if two pointers are already active
        return;
      }

      if (evt.pointerType === 'mouse') {
        this.canvas.setPointerCapture(evt.pointerId);
      }

      const data = {
        startMouseCoord: [evt.offsetX, evt.offsetY] as vec2,
        startWorldCoord: this.mouseToWorld(evt.offsetX, evt.offsetY),
      };

      activePointersByID.set(evt.pointerId, { curMouseCoord: [evt.offsetX, evt.offsetY] });
      if (activePointersByID.size === 1) {
        dragData = data;
      } else if (activePointersByID.size === 2) {
        if (!dragData) {
          throw new UnreachableError('Drag data not set and two pointers are active');
        }

        const pointerData = Array.from(activePointersByID.values());
        const [first, second] = pointerData;
        const initialDistancePixels = Math.hypot(
          first.curMouseCoord[0] - second.curMouseCoord[0],
          first.curMouseCoord[1] - second.curMouseCoord[1]
        );
        const firstWorld = this.mouseToWorld(first.curMouseCoord[0], first.curMouseCoord[1]);
        const secondWorld = this.mouseToWorld(second.curMouseCoord[0], second.curMouseCoord[1]);
        const midpointWorld: vec2 = [(firstWorld[0] + secondWorld[0]) / 2, (firstWorld[1] + secondWorld[1]) / 2];
        dragData.pinchZoomData = {
          lastDistancePixels: initialDistancePixels,
          lastMidpointWorld: midpointWorld,
        };
      }
    };

    const handlePointerUp = (evt: PointerEvent) => {
      evt.preventDefault();

      const didExist = activePointersByID.delete(evt.pointerId);
      if (!didExist) {
        return;
      }
      if (dragData?.pinchZoomData && activePointersByID.size <= 1) {
        const pointer = Array.from(activePointersByID.values())[0];
        dragData = {
          startMouseCoord: pointer.curMouseCoord,
          startWorldCoord: this.mouseToWorld(pointer.curMouseCoord[0], pointer.curMouseCoord[1]),
        };
        return;
      }

      const didMove =
        !!dragData &&
        Math.hypot(evt.offsetX - dragData.startMouseCoord[0], evt.offsetY - dragData.startMouseCoord[1]) > 5;

      if (activePointersByID.size === 0) {
        dragData = null;
      }

      if (evt.pointerType === 'mouse') {
        this.canvas.releasePointerCapture(evt.pointerId);
      }

      const hit = this.hitTest(evt.offsetX, evt.offsetY);
      if (didMove) {
        return;
      }

      const oldSelectedScoreIx = get(this.selectedScoreIx);
      if ((hit === null && oldSelectedScoreIx !== null) || (hit !== null && hit === oldSelectedScoreIx)) {
        this.selectedScoreIx.set(null);
        this.updatePointSize(oldSelectedScoreIx);
      } else if (hit !== null && oldSelectedScoreIx !== hit) {
        this.selectedScoreIx.set(hit);
        if (oldSelectedScoreIx !== null) {
          this.updatePointSize(oldSelectedScoreIx);
        }
        this.updatePointSize(hit);
      }
    };

    const handlePointerMove = (evt: PointerEvent) => {
      evt.preventDefault();

      const pointerEntry = activePointersByID.get(evt.pointerId);
      if (pointerEntry) {
        pointerEntry.curMouseCoord = [evt.offsetX, evt.offsetY];

        if (activePointersByID.size === 2) {
          // pinch-to-zoom for mobile multi-touch
          const pointerData = Array.from(activePointersByID.values());
          const [first, second] = pointerData;

          if (!dragData?.pinchZoomData) {
            throw new UnreachableError('Expected pinch zoom data to be set');
          }

          const curDistancePixels = Math.hypot(
            first.curMouseCoord[0] - second.curMouseCoord[0],
            first.curMouseCoord[1] - second.curMouseCoord[1]
          );

          const scaleAdjustment = curDistancePixels / dragData.pinchZoomData.lastDistancePixels;
          mat3.scale(this.transformMatrix, this.transformMatrix, [scaleAdjustment, scaleAdjustment]);

          dragData.pinchZoomData.lastDistancePixels = curDistancePixels;

          const curMidpointPixels = [
            (first.curMouseCoord[0] + second.curMouseCoord[0]) / 2,
            (first.curMouseCoord[1] + second.curMouseCoord[1]) / 2,
          ];
          const curMidpointWorld = this.mouseToWorld(curMidpointPixels[0], curMidpointPixels[1]);
          const translation = vec2.sub(vec2.create(), curMidpointWorld, dragData.pinchZoomData.lastMidpointWorld);

          mat3.translate(this.transformMatrix, this.transformMatrix, translation);

          return;
        }
      }

      if (dragData) {
        const mouseWorldBefore = dragData.startWorldCoord;
        const mouseWorldAfter = this.mouseToWorld(evt.offsetX, evt.offsetY);

        // translate to keep the same point in the world under the cursor
        mat3.translate(this.transformMatrix, this.transformMatrix, [
          mouseWorldAfter[0] - mouseWorldBefore[0],
          mouseWorldAfter[1] - mouseWorldBefore[1],
        ]);
      }

      const oldHoveredScoreIx = this.hoveredScoreIx;
      this.hoveredScoreIx = this.hitTest(evt.offsetX, evt.offsetY);
      if ((oldHoveredScoreIx === null) !== (this.hoveredScoreIx === null) && evt.pointerType === 'mouse') {
        this.canvas.style.cursor = this.hoveredScoreIx === null ? 'default' : 'pointer';
      }

      const dpr = window.devicePixelRatio || 1;
      if (oldHoveredScoreIx !== this.hoveredScoreIx) {
        if (this.hoveredScoreIx !== null) {
          const newRadius = this.computePointRadius(dpr, get(this.selectedScoreIx), this.hoveredScoreIx);
          this.curRadii[this.hoveredScoreIx] = newRadius;
          this.props.radii.subdata([newRadius], this.hoveredScoreIx * 4);
        }
        if (oldHoveredScoreIx !== null) {
          const newRadius = this.computePointRadius(dpr, get(this.selectedScoreIx), oldHoveredScoreIx);
          this.curRadii[oldHoveredScoreIx] = newRadius;
          this.props.radii.subdata([newRadius], oldHoveredScoreIx * 4);
        }
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

      this.buildColorLegend();
    };

    this.inputCbs = {
      pointerDown: handlePointerDown,
      pointerMove: handlePointerMove,
      pointerUp: handlePointerUp,
      wheel: handleWheel,
      windowResize: handleWindowResize,
    };

    this.canvas.addEventListener('wheel', handleWheel);
    this.canvas.addEventListener('pointerdown', handlePointerDown);
    this.canvas.addEventListener('pointerup', handlePointerUp);
    this.canvas.addEventListener('pointermove', handlePointerMove);
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
    this.colorLegend?.remove();

    this.canvas.removeEventListener('wheel', this.inputCbs.wheel);
    this.canvas.removeEventListener('pointerdown', this.inputCbs.pointerDown);
    this.canvas.removeEventListener('pointermove', this.inputCbs.pointerMove);
    this.canvas.removeEventListener('pointerup', this.inputCbs.pointerUp);
    window.removeEventListener('resize', this.inputCbs.windowResize);
  }
}
