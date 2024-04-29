import * as PixiViewport from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import type { Corpus } from '../corpus';

const WORLD_SIZE = 20;

export class AtlasViz {
  private app: PIXI.Application;
  private container!: PixiViewport.Viewport;
  private corpus: Corpus;

  constructor(canvas: HTMLCanvasElement, corpus: Corpus) {
    this.app = new PIXI.Application();
    this.corpus = corpus;

    this.init(canvas);
  }

  private async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      antialias: true,
      resolution: window.devicePixelRatio,
      autoDensity: true,
      view: canvas,
      height: window.innerHeight,
      width: window.innerWidth,
      backgroundColor: 0,
    });

    this.container = new PixiViewport.Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: window.innerWidth,
      worldHeight: window.innerHeight,
      events: this.app.renderer.events,
    });
    this.container.drag({ mouseButtons: 'middle-left' }).pinch().wheel();
    // TODO: should be dynamic based on screen size
    this.container.updateTransform({ scaleX: 20, scaleY: 20, x: 1100, y: 600 });
    setInterval(() => console.log(this.container.worldTransform, this.container.localTransform), 1000);

    this.app.stage.addChild(this.container);

    const nodeTexture = this.buildNodeTexture();
    for (const item of this.corpus) {
      const sprite = new PIXI.Sprite(nodeTexture);
      sprite.tint = 0xff0000;
      sprite.x = item.position[0];
      sprite.y = item.position[1];
      sprite.scale.set(0.01);
      this.container.addChild(sprite);
    }
  }

  buildNodeTexture = (): PIXI.Texture => {
    const g = new PIXI.Graphics();
    g.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 1 });
    return this.app.renderer.generateTexture({
      target: g,
      resolution: 5,
      antialias: true,
    });
  };
}
