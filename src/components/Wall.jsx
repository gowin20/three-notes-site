import { Canvas,useThree, useFrame } from '@react-three/fiber';
import GalleryControls from "../lib/GalleryControls";
import * as THREE from "three";
import {Layout, focusNote, clearFocus} from "./Layout";
import DetailsPane from './DetailsPane';
import { BlurBackground,clearBlur }from "./Blur";
import "../css/main.css"

let controls;
let lastClickTime;

function Controls() {
    const three = useThree();

    three.gl.preserveDrawingBuffer = true;

    three.scene.background = new THREE.Color("#1F1F1F")
    
    controls = new GalleryControls(three.camera,three.gl.domElement,{
        mode:"plane",
        target: new THREE.Plane(new THREE.Vector3(0,0,1)),
        minDistance:0.5,
        maxDistance:5
    })

    three.controls = controls;

    useFrame(() => {
        controls.update();
    })
    return <></>
}

export function clearNote() {}

export default function Wall() {

    let setNoteDetails, toggleBlur, currentNote;

    const onDetailsMount = (dataFromDetails) => {
        setNoteDetails = dataFromDetails[1];
    }
    const onBlurMount = (blurHooks) => {
        toggleBlur = blurHooks[1]
    }

    function blurArea() {
        const visible = controls.targetAreaVisible();
        toggleBlur({
            enabled:true,
            bbox:visible
        })
    }

    function noteClicked(e) {
        console.log(e.timeStamp)
        console.log(lastClickTime);
        console.log(currentNote)
        if (currentNote != null) return;

        openNote(e.object);
    }

    async function openNote(object) {
        currentNote = object.userData;
        clearFocus();
        
        focusNote(currentNote);
        
        setNoteDetails(currentNote);
        controls.zoomTo(object);
        
        // wait for zoom to complete before blurring the area
        for (let i=0;i<15;i++) {
            controls.update();
        }
        blurArea();
        
       
    }

    function clearNote() {
        setNoteDetails(null);
        clearFocus();
        clearBlur();
        currentNote = null;
    }
    document.addEventListener("drag",e=>{
        console.log(e)
    })

    document.addEventListener("mousedown",e=>{
        console.log(e)
        lastClickTime = e.timeStamp;
    })

    document.addEventListener("mousemove", e => {
        if (e.buttons == 1) {
            clearNote();
        };
    })
    document.addEventListener("wheel",()=>{
        clearNote();
    })
    document.addEventListener("mouseup", (e)=>{
        e.preventDefault();
    })

    return (
        <div className="wall">
        <DetailsPane onMount={onDetailsMount}/>
        <div className="canvasContainer">
                <Canvas background={new THREE.Color("#000000")}>
                    <BlurBackground onMount={onBlurMount}/>
                    <Layout clickFcn={noteClicked}/>
                    <Controls/>
                </Canvas>
        </div>
        </div>
    )

}