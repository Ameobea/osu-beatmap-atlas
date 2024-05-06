import { clamp } from '../util';

import * as d3 from '../d3';

interface ColorLegendParams {
  widthPx: number;
  heightPx: number;
  minVal: number;
  maxVal: number;
  title: string;
}

export const buildColorLegend = (
  colorFn: (n: number) => [number, number, number],
  { widthPx, heightPx, minVal, maxVal, title }: ColorLegendParams
): HTMLElement => {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  const labelMarginLeft = 6;
  canvas.style.left = `${labelMarginLeft}px`;

  const ctx = canvas.getContext('2d')!;
  if (!ctx) {
    return canvas;
  }
  for (let i = 0; i < widthPx; i++) {
    const color = colorFn((i / widthPx) * (maxVal - minVal) + minVal);
    const r = clamp(color[0] * 255, 0, 255);
    const g = clamp(color[1] * 255, 0, 255);
    const b = clamp(color[2] * 255, 0, 255);

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(i, 0, 1, heightPx);
  }

  const svg = d3
    .select(document.createElement('div'))
    .append('svg')
    .attr('width', `${widthPx + labelMarginLeft + 8}px`)
    .attr('height', `${heightPx + 38}px`);
  const scale = d3.scaleLinear().domain([minVal, maxVal]).range([0, widthPx]);
  svg
    .append('g')
    .attr('transform', `translate(${labelMarginLeft},${heightPx})`)
    .call(d3.axisBottom(scale).ticks(6).tickSize(6))
    .call((g) => g.select('.domain').remove());

  svg
    .append('text')
    .attr('x', 0)
    .attr('y', heightPx + 32)
    .style('text-anchor', 'left')
    .style('font-size', '13px')
    .style('font-weight', 'normal')
    .style('fill', 'currentColor')
    .text(title);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '4px';

  container.appendChild(svg.node()!);
  container.appendChild(canvas);
  container.classList.add('color-legend');

  return container;
};
