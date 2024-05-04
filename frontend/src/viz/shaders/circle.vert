precision mediump float;

attribute vec2 position;
attribute float radius;
attribute vec4 color;
attribute float alphaMultiplier;

uniform mat3 transformMatrix;
uniform vec2 hoveredCirclePosition;
uniform vec2 selectedCirclePosition;

varying float vBorderWidth;
varying float vBorderFade;
varying float vCenterAlpha;
varying vec4 vColor;
varying float vAlphaMultiplier;

void main() {
    bool isHovered = position == hoveredCirclePosition;
    bool isSelected = position == selectedCirclePosition;
    gl_PointSize = radius + (isHovered && !isSelected ? clamp(0.4 * radius, 8., 22.) : 0.) + (isSelected ? clamp(0.6 * radius, 12., 26.) : 0.);

    vec2 viewportCoords = (transformMatrix * vec3(position, 1.0)).xy;
    gl_Position = vec4(viewportCoords, 0., 1.);

    vColor = color;
    // further reduce the alpha of low-alpha circles when zoomed out far
    float extraAlphaMultiplier = alphaMultiplier < 0.5 ? 0.4 + 0.6 * smoothstep(0.01, 0.03, transformMatrix[0].x) : 1.;
    vAlphaMultiplier = alphaMultiplier * extraAlphaMultiplier;

    // relative border width gets smaller as the circle gets larger
    float borderWidthFactor = 1. - smoothstep(10., 130., radius);
    vBorderWidth = 0.003 + 0.1 * borderWidthFactor;

    // border fade region gets smaller as the circle gets larger since it's a relative factor
    float borderFadeActivation = 1. - smoothstep(50., 500., radius);
    vBorderFade = 0.002 + 0.02 * borderFadeActivation;

    // center alpha gets closer to 1 as the circle gets smaller
    float centerAlphaFactor = 1. - smoothstep(6., 22., radius);
    vCenterAlpha = 0.55 + 0.4 * centerAlphaFactor;
}
