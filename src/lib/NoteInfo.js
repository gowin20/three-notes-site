import SampleNotes from "../sample-notes-2.json";
import SmallSampleNotes from "../small-sample-notes.json";

export function getNotes(props=null) {
    if (props === "sample") {
        return SampleNotes
    }
    else if (props === "small-sample") {
        return SmallSampleNotes
    }

    return SampleNotes;
}