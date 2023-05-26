import Details from "./Details";
import { useEffect, useState } from 'react';
import { clearFocus } from "./Layout";
import { clearBlur } from "./Blur";

export default function DetailsPane({onMount}) {

    const [note, setNote] = useState(null);
    useEffect(()=>{
        onMount([note,setNote]);
    }, [onMount,note])

    
    function closeDetails() {
        setNote(null);   
        clearFocus();
        clearBlur();
    }


    /*
<button className="closeButton" onClick={closeDetails}>
            <svg viewBox="0 0 12 12" version="1.1" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="11" x2="11" y2="1" stroke="black" strokeWidth="2"/><line x1="1" y1="1" x2="11" y2="11" stroke="black" strokeWidth="2"/></svg>
            </button>
    */
    if (note) return (
        <div className="details">
            <Details note={note}/>
        </div>
        )
    else return <></>
}