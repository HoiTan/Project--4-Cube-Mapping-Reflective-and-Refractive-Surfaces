#version 330 compatibility

//
// UNIFORMS from First Shader
//
uniform sampler3D    Noise3;
uniform float        uNoiseAmp;
uniform float        uNoiseFreq;
uniform float        uEta;        // refraction index ratio
uniform float        uMix;        // reflection/refraction mix
uniform float        uWhiteMix;   // how much to mix refraction with white
uniform samplerCube  uReflectUnit;
uniform samplerCube  uRefractUnit;

//
// UNIFORMS from Second Shader
//
uniform float        uAmp0, uAmp1;
uniform float        uPhaseShift;
uniform float        uPd;
uniform float        uLightX, uLightY, uLightZ;
uniform vec4         uColor;
uniform float        Timer;

//
// VARYINGS / IN variables from vertex shader(s).
// Make sure your vertex shader supplies these correctly.
//
in vec3 vMC;           // "model coordinates" used for noise sampling
in vec3 vNormal;       // (if you still use it somewhere; may not be needed)
in vec3 vEyeDir;       // view direction (should be in same space as the normal)
in vec3 vECposition;   // eye coords for lighting computations (optional)

//
// Constants
//
const float  TWOPI = 6.28318530718;
const vec3   C0    = vec3( -2.5, 0.0, 0.0 );
const vec3   C1    = vec3(  2.5, 0.0, 0.0 );
const vec3   WHITE = vec3(  1.0, 1.0, 1.0 );

//
// Function: Perturb a normal by rotating it around X/Y/Z
//
vec3 PerturbNormal3( float angx, float angy, float angz, vec3 n )
{
    float cx = cos( angx );
    float sx = sin( angx );
    float cy = cos( angy );
    float sy = sin( angy );
    float cz = cos( angz );
    float sz = sin( angz );
    
    // rotate about X:
    float yp =  n.y*cx - n.z*sx;
    n.z      =  n.y*sx + n.z*cx;
    n.y      =  yp;

    // rotate about Y:
    float xp =  n.x*cy + n.z*sy;
    n.z      = -n.x*sy + n.z*cy;
    n.x      =  xp;

    // rotate about Z:
          xp =  n.x*cz - n.y*sz;
    n.y      =  n.x*sz + n.y*cz;
    n.x      =  xp;

    return normalize( n );
}

void main( )
{
    //--------------------------------------------------------------------
    // 1. Compute the Wave Normal (from second shader's logic):
    //--------------------------------------------------------------------
    float uTime = Timer * 10.0;

    // Wave 0:
    float rad0 = length( vMC - C0 );
    // (H0 is not directly used in shading here, but might be if you need the height)
    // float H0 = -uAmp0 * cos( TWOPI*rad0/uPd - TWOPI*uTime );

    // partial derivative wrt radius:
    float u = -uAmp0 * (TWOPI / uPd)
              * sin( TWOPI * rad0 / uPd - TWOPI * uTime );
    float v = 0.0;
    float w = 1.0; 
    // direction angle from center C0:
    float ang = atan( vMC.y - C0.y, vMC.x - C0.x );

    float up = dot( vec2(u,v), vec2( cos(ang), -sin(ang) ) );
    float vp = dot( vec2(u,v), vec2( sin(ang),  cos(ang) ) );
    float wp = 1.0;

    // Wave 1:
    float rad1 = length( vMC - C1 );
    // float H1 = -uAmp1 * cos( TWOPI*rad1/uPd - TWOPI*uTime );

    u = -uAmp1 * (TWOPI / uPd)
        * sin( TWOPI * rad1 / uPd - TWOPI*uTime - uPhaseShift );
    v = 0.0;
    ang = atan( vMC.y - C1.y, vMC.x - C1.x );
    up += dot( vec2(u,v), vec2( cos(ang), -sin(ang) ) );
    vp += dot( vec2(u,v), vec2( sin(ang),  cos(ang) ) );
    wp += 1.0;

    // Base wave normal in object space:
    vec3 waveNormal = normalize( vec3(up, vp, wp) );


    //--------------------------------------------------------------------
    // 2. Add Noise-based Perturbation (from first shader's logic):
    //--------------------------------------------------------------------
    // Sample 3 slices in the 3D noise:
    vec4 nvx = texture( Noise3, uNoiseFreq * vMC );
    vec4 nvy = texture( Noise3, uNoiseFreq * (vMC + vec3(0.0, 0.0, 0.33)) );
    vec4 nvz = texture( Noise3, uNoiseFreq * (vMC + vec3(0.0, 0.0, 0.67)) );

    float angx = (nvx.r + nvx.g + nvx.b + nvx.a) - 2.0;  // [-2..+2] after shift
    angx *= uNoiseAmp;

    float angy = (nvy.r + nvy.g + nvy.b + nvy.a) - 2.0;
    angy *= uNoiseAmp;

    float angz = (nvz.r + nvz.g + nvz.b + nvz.a) - 2.0;
    angz *= uNoiseAmp;

    // Apply rotation:
    vec3 perturbedNormal = PerturbNormal3( angx, angy, angz, waveNormal );

    //--------------------------------------------------------------------
    // 3. Transform Normal to Eye Space if needed
    //    (depends on your pipeline; using legacy gl_NormalMatrix for example):
    //--------------------------------------------------------------------
    // Because #version 330 compatibility still allows gl_NormalMatrix:
    vec3 N = normalize( gl_NormalMatrix * perturbedNormal );

    //--------------------------------------------------------------------
    // 4. Reflection / Refraction Calculations (first shader):
    //--------------------------------------------------------------------
    // Make sure vEyeDir is also in eye space (or same space as N).
    vec3 E = normalize( vEyeDir );

    // Reflect:
    vec3 reflectVector = reflect( E, N );
    vec3 reflectColor  = texture( uReflectUnit, reflectVector ).rgb;

    // Refract:
    vec3 refractVector = refract( E, N, uEta );
    vec3 refractColor;
    if( all(equal(refractVector, vec3(0.,0.,0.))) )
    {
        // total internal reflection
        refractColor = reflectColor;
    }
    else
    {
        refractColor = texture( uRefractUnit, refractVector ).rgb;
        refractColor = mix( refractColor, WHITE, uWhiteMix );
    }

    // Mix reflect/refract:
    vec3 envColor = mix( refractColor, reflectColor, uMix );

    gl_FragColor = vec4( envColor, uColor.a );
}
