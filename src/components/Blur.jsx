import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useState,useEffect } from 'react';
let blur, setBlur;

export function clearBlur() {
    setBlur({
        enabled:false
    })
}

// returns a blurred version of the input texture
async function generateBlurredTexture(texture) {

    const width = texture.image.width;
    const height = texture.image.height;
  
    const cameraRTT = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sceneRTT = new THREE.Scene();
  
    // render targets
  
    const renderTargetTemp = new THREE.WebGLRenderTarget(width, height);
    const renderTargetFinal = new THREE.WebGLRenderTarget(width, height);
  
    // shader materials
  
    const hBlurMaterial = new THREE.ShaderMaterial({
      vertexShader: THREE.HorizontalBlurShader.vertexShader,
      fragmentShader: THREE.HorizontalBlurShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(THREE.HorizontalBlurShader.uniforms)
    });
  
    hBlurMaterial.uniforms.tDiffuse.value = texture;
    hBlurMaterial.uniforms.h.value = 1 / width;
  
    const vBlurMaterial = new THREE.ShaderMaterial({
      vertexShader: THREE.VerticalBlurShader.vertexShader,
      fragmentShader: THREE.VerticalBlurShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(THREE.VerticalBlurShader.uniforms)
    });
  
    vBlurMaterial.uniforms.tDiffuse.value = renderTargetTemp.texture;
    vBlurMaterial.uniforms.v.value = 1 / height;
  
    // fullscreen quad
  
    const planeGeometry = new THREE.PlaneGeometry(2, 2);
  
    const fullScreenQuad = new THREE.Mesh(planeGeometry, hBlurMaterial);
    sceneRTT.add(fullScreenQuad);
  
    // first pass
  
    renderer.setRenderTarget(renderTargetTemp);
    renderer.render(sceneRTT, cameraRTT);
    renderer.setRenderTarget(null);
  
    // second pass
  
    fullScreenQuad.material = vBlurMaterial;
  
    renderer.setRenderTarget(renderTargetFinal);
    renderer.render(sceneRTT, cameraRTT)
    renderer.setRenderTarget(null);
  
    //
  
    return renderTargetFinal.texture;
  
}

export function BlurBackground(props) {
    [blur, setBlur] = useState({
        enabled:false,
        bbox:null
    });
    useEffect(()=>{
        props.onMount([blur,setBlur]);
    }, [props.onMount,blur])

    const three = useThree();
    
    if (!blur.enabled) return <></>;

    console.log(blur.bbox)
    

    const imgOfCurrent = three.gl.domElement.toDataURL('image/jpeg');

    const size = new THREE.Vector2();
    const center = new THREE.Vector2();
    blur.bbox.getSize(size);
    blur.bbox.getCenter(center);
    console.log(size,center)

    const loader = new THREE.TextureLoader();
    const texture = loader.loadAsync(imgOfCurrent);
    //const blurredTexture = generateBlurredTexture(texture);  map={blurredTexture}
    //console.log(blurredTexture);
    return (
        <sprite position={new THREE.Vector3(center.x, center.y, 1)} scale={size.x}>
            <spriteMaterial opacity={1} color={'#171717'}></spriteMaterial>
        </sprite>
    )
}