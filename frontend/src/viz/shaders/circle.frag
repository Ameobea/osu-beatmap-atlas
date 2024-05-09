precision mediump float;

varying vec3 vColor;
varying float vBorderWidth;
varying float vBorderFade;
varying float vRimAlpha;
varying float vCenterAlpha;

void main() {
    float r = length(gl_PointCoord - vec2(0.5));

    float borderOuter = 0.5 - vBorderFade;
    float borderInner = borderOuter - vBorderWidth;

    // clip outer edge of the circle
    float alpha = 1. - smoothstep(borderOuter, 0.5, r);

    if (alpha < 0.01) {
        discard;
    }

    // inner part of the circle has reduced opacity
    float rimFactor = smoothstep(borderInner - vBorderFade, borderInner, r);
    alpha *= mix(vCenterAlpha, vRimAlpha, rimFactor);

    gl_FragColor = vec4(vColor.rgb, alpha);
}
