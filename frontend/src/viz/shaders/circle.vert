precision mediump float;

attribute vec2 position;
attribute float radius;
attribute vec4 color;

uniform mat3 transformMatrix;

varying float vBorderWidth;
varying float vBorderFade;
varying float vCenterAlpha;
varying vec4 vColor;

void main() {
    float zoomLevel = length(transformMatrix[0].xy);
    float scaleFactor = clamp(zoomLevel, 0.14, 0.324);
    float scaledRadius = clamp(radius * scaleFactor, 4.2, 10000.);
    gl_PointSize = scaledRadius;

    vec2 viewportCoords = (transformMatrix * vec3(position, 1.0)).xy;
    gl_Position = vec4(viewportCoords, 0., 1.);

    vColor = color;

    // relative border width gets smaller as the circle gets larger
    float borderWidthFactor = 1. - smoothstep(10., 130., scaledRadius);
    vBorderWidth = 0.003 + 0.1 * borderWidthFactor;

    // border fade region gets smaller as the circle gets larger since it's a relative factor
    float borderFadeActivation = 1. - smoothstep(50., 500., scaledRadius);
    vBorderFade = 0.002 + 0.02 * borderFadeActivation;

    // center alpha gets closer to 1 as the circle gets smaller
    float centerAlphaFactor = 1. - smoothstep(6., 22., scaledRadius);
    vCenterAlpha = 0.55 + 0.4 * centerAlphaFactor;
}
