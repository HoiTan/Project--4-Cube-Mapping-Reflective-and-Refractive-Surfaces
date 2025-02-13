#version 330 compatibility

out vec3	vNormal;
out vec3	vEyeDir;
out vec3	vMC;


void
main( )
{    
	vMC = gl_Vertex.xyz;
	vec3 ECposition = ( gl_ModelViewMatrix * gl_Vertex ).xyz;
	vEyeDir = ECposition.xyz - vec3( 0., 0., 0. ) ; 
	       		// vector from the eye position to the point
	vNormal = normalize( gl_Normal );

	gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;
}