precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
void main(void)
{
    vec3 lightDirEyeSpace = normalize(vec3(1.0,1.0,1.0));
    vec3 diffuseLight = vec3(max(0.0, dot(lightDirEyeSpace, vNormal)));
    vec3 ambientLight = vec3(0.3,0.3,0.3);
    vec3 light = max(diffuseLight, ambientLight);
    gl_FragColor = vec4( vColor.xyz, 1.0 );
}