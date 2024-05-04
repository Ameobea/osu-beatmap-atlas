precision mediump float;

varying vec4 vColor;
varying float vBorderWidth;
varying float vBorderFade;
varying float vCenterAlpha;
varying float vAlphaMultiplier;

void main() {
    float r = length(gl_PointCoord - vec2(0.5));

    float borderOuter = 0.5 - vBorderFade;
    float borderInner = borderOuter - vBorderWidth;

    float alpha = 1. - smoothstep(borderOuter, 0.5, r);
    alpha *= vAlphaMultiplier;

    if (alpha < 0.01) {
        discard;
    }

    // inner part of the circle has reduced opacity
    alpha *= mix(vCenterAlpha, 1.0, smoothstep(borderInner - vBorderFade, borderInner, r));

    gl_FragColor = vec4(vColor.rgb, alpha) * (vAlphaMultiplier < 0.5 ? 0.8 : 1.);
}
