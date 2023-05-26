import { Component, useState, useEffect } from 'react';
import { TextureLoader, Vector3 } from 'three';
//import { setNote } from "./Wall";
import {memo} from "react";

const prefixUrl = 'https://the-wall-source.s3.us-west-1.amazonaws.com/notes/initial-test/'

function Note(props) {
    console.log("note rendered",props.url);
    
    const [focused, setFocused] = useState(null);
    const [url, setUrl] = useState(props.url);
    useEffect(()=>{
        props.onMount([url,setFocused]);
    }, [props.onMount,focused])


    return (
        <sprite 
        onClick={props.clickFcn}
        position={focused ? new Vector3(props.position[0], props.position[1],2) : props.position}
        scale={1}
        userData={props.id}
        >
        <spriteMaterial
            map={new TextureLoader().load(prefixUrl+props.url)}
        />
        </sprite>
    )
}

export default memo(Note);