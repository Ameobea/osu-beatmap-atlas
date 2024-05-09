precision highp float;

attribute vec2 position;
attribute float radius;
attribute vec3 color;
attribute float alphaMultiplier;

uniform mat3 transformMatrix;
uniform vec2 hoveredCirclePosition;
uniform vec2 selectedCirclePosition;
uniform float dpr;
uniform float zoomLevel;

varying float vBorderWidth;
varying float vBorderFade;
varying float vCenterAlpha;
varying float vRimAlpha;
varying vec3 vColor;

void main() {
    gl_PointSize = radius * dpr;

    vec2 viewportCoords = (transformMatrix * vec3(position, 1.0)).xy;
    gl_Position = vec4(viewportCoords, 0., 1.);

    bool isSelected = position == selectedCirclePosition;
    bool isHovered = position == hoveredCirclePosition;

    vColor = color.rgb;

    // relative border width gets smaller as the circle gets larger
    float borderWidthFactor = 1. - smoothstep(10., 130., radius);
    vBorderWidth = 0.003 + 0.1 * borderWidthFactor + 0.1 * float(isSelected);

    // border fade region gets smaller as the circle gets larger since it's a relative factor
    float borderFadeActivation = 1. - smoothstep(50., 500., radius);
    vBorderFade = 0.002 + 0.02 * borderFadeActivation;

    // center alpha gets closer to 1 as the circle gets smaller
    float centerAlphaFactor = 1. - smoothstep(6., 22., radius);
    vCenterAlpha = 0.7 + 0.2 * centerAlphaFactor;

    // further reduce the alpha of low-alpha circles when zoomed out far
    float zoomFactor = pow(smoothstep(4.6, 5.7, zoomLevel), 0.8);
    float zoomAlphaMultiplier = alphaMultiplier < 1. ? 0.24 + 0.76 * zoomFactor : 1.;

    vRimAlpha = mix(alphaMultiplier, 1., 0.38) * zoomAlphaMultiplier;

    float centerAlphaMultiplier = alphaMultiplier;
    if (isSelected) {
        centerAlphaMultiplier = max(centerAlphaMultiplier, 0.9);
        vRimAlpha = 1.;
    } else if (isHovered) {
        centerAlphaMultiplier = max(centerAlphaMultiplier, 0.75);
        vRimAlpha = 1.;
    }
    vCenterAlpha *= centerAlphaMultiplier;

}
