precision highp float;

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
varying float vIsSelected;

void main() {
    gl_PointSize = radius;

    vec2 viewportCoords = (transformMatrix * vec3(position, 1.0)).xy;
    gl_Position = vec4(viewportCoords, 0., 1.);

    // cull circles that are outside the viewport
    if (gl_Position.x < -1. || gl_Position.x > 1. || gl_Position.y < -1. || gl_Position.y > 1.) {
        gl_Position = vec4(0., 0., -1., 1.);
        return;
    }

    bool isSelected = position == selectedCirclePosition;
    bool isHovered = position == hoveredCirclePosition;
    vIsSelected = float(isSelected);

    vColor = color;
    // further reduce the alpha of low-alpha circles when zoomed out far
    float extraAlphaMultiplier = 1.;
    if (alphaMultiplier < 0.5) {
        extraAlphaMultiplier = 0.3 + 0.7 * smoothstep(0.01, 0.05, transformMatrix[0].x);
    }
    vAlphaMultiplier = alphaMultiplier * extraAlphaMultiplier;
    if (isSelected) {
        vAlphaMultiplier = max(vAlphaMultiplier, 0.9);
    } else if (isHovered) {
        vAlphaMultiplier = max(vAlphaMultiplier, 0.7);
    }

    // relative border width gets smaller as the circle gets larger
    float borderWidthFactor = 1. - smoothstep(10., 130., radius);
    vBorderWidth = 0.003 + 0.1 * borderWidthFactor + 0.1 * vIsSelected;

    // border fade region gets smaller as the circle gets larger since it's a relative factor
    float borderFadeActivation = 1. - smoothstep(50., 500., radius);
    vBorderFade = 0.002 + 0.02 * borderFadeActivation;

    // center alpha gets closer to 1 as the circle gets smaller
    float centerAlphaFactor = 1. - smoothstep(6., 22., radius);
    vCenterAlpha = 0.7 + 0.2 * centerAlphaFactor;
}
