//-----------
// Utility functions
//-----------

// Convert text string to binary string
function textToBin(text, charcodes) {
    var length = text.length,
        output = [];
    for (var i = 0;i < length; i++) {
        if (charcodes[text[i]]){
            var bin = charcodes[text[i]];
            output.push(bin.split("").join("-"));
        } else {
            output.push("1-0-1-0-1-0");
        }
    } 
    return output.join("=");
}

// Play the shound of a character
// 0 and 1 are for the binary numbers
// - is the digit separator
// = is the letter separator
// S, Y and N are offset sync characters
function playChar(char, src, callback){

    // maybe change these elifs to switch?
    if (char == "1"){
        src.frequency.value = 850;
        src.start("+0.15")
    } else if(char == "0") {
        src.frequency.value = 450;
        src.start("+0.15")
    } else if(char == "-"){
        src.frequency.value = 650;
        src.start("+0.15")
    }
    else if(char == "="){
        src.frequency.value = 1200;
        src.start("+0.15")
    }
    else if(char == "S"){
        src.frequency.value = 1800;
        src.start("+0.15")
    }
    else if(char == "Y"){
        src.frequency.value = 1600;
        src.start("+0.15")
    }
    else if(char == "N"){
        src.frequency.value = 1400;
        src.start("+0.15")
    }
}

// Find the main frequency in the frequency data
function calculateHertz (frequencies, options) {
    var rate = 22050 / 1024;
  
    if (options) {
      if (options.rate) {
        rate = options.rate;
      }
    }
  
    var maxI, max = frequencies[0];
    
    for (var i=0; frequencies.length > i; i++) {
      var oldmax = parseFloat(max);
      var newmax = Math.max(max, frequencies[i]);
      if (oldmax != newmax) {
        max = newmax;
        maxI = i;
      } 
    }
    return maxI * rate;
  }

//-----------
// Main code
//-----------

$(document).ready(function(){
    // Load charcodes
    var charcodes = {}
    var codechars = {}
    $.getJSON("charcodes.json", function(data){
        for (var i = 0; i<data.sequence.length; i++){
            charcodes[data.sequence[i]] = (i+1).toString(2);
            codechars[(i+1).toString(2)] = data.sequence[i]
        }
        for (var key in data.specials){
            charcodes[key] = data.specials[key]
            codechars[data.specials[key]] = key
        }
        $("#sendbtn").attr("disabled", false)
    })

    // Encoder

    //Init Tone.js oscillator
    var osc = new Tone.Oscillator({
        "type" : "sine",
        "frequency" : 450,
        "volume" : 0
    }).toMaster();


    // Start modulation
    $("#sendbtn").click(function(){
        var binCode = "-    S Y N ="+textToBin($("#txtinpt").val().toUpperCase(), charcodes)+"= S Y N   -";
        console.log("Modulating " + binCode)

        // Loop through every character
        var cnt = 0;
        var loop = setInterval(function(){
            if (cnt < binCode.length+2){
                playChar(binCode[cnt], osc);
                cnt++;
            } else {
                clearInterval(loop);
                osc.stop()
            }
        },100) // delay between characters

    })

    // Decoder

    // Request user media permissions for recording audio
    navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false,
            noiseSupression: false,
            autoGainControl:false
        },
        video: false})
    .then(function(stream){

        // Starting context and nodes
        var context = new AudioContext();
        var source = context.createMediaStreamSource(stream);
        var analyzer = context.createAnalyser(); // For frequency analysis
        var processor = context.createScriptProcessor(1024, 1, 1) // For the audio processing ticks

        var frequencies = new Float32Array(analyzer.frequencyBinCount); // Frequency buffer array

        // Connect the microphone to the nodes
        source.connect(analyzer);
        source.connect(processor);
        processor.connect(context.destination)

        // JQuery elements
        var leftEl = $("#350")
        var rightEl = $("#550")
        var read = $("#read")
        var decfield = $("#decoded")
        var freq = $("#freq")

        // Aux variables
        var oldhz = 0;
        var decoding = "" // current letter being decoded
        var decoded = "" // decoded message
        var correctionOffset = 0
        var SYNb = [] // SYN header buffer

        // Runs code on every audio processor tick
        processor.onaudioprocess = function(e){

            // Get current frequency in hertz
            analyzer.getFloatFrequencyData(frequencies);
            var hz = Math.round(calculateHertz(frequencies, {rate: 24000/1024}))+correctionOffset;
            
            // Frequency range checks
            if (hz > 350 && hz < 550){
                if (oldhz != hz){ // Only if changed
                    decoding += "0"
                    leftEl.css("background-color", "green")
                    rightEl.css("background-color", "transparent")
                    
                    read.html(6-decoding.length) // display countdown
                }
            } else if (hz > 750 && hz < 950) {
                if (oldhz != hz){
                    decoding += "1"
                    rightEl.css("background-color", "green")
                    leftEl.css("background-color", "transparent")
                    
                    read.html(6-decoding.length)
                }
            } else if (hz > 1000) { //letter separator
                if (oldhz != hz){
                    if (decoding == "0"){
                        decoded += " "
                    }
                    else {
                        if (codechars[decoding]){
                            decoded += codechars[decoding]
                        }
                    }
                    decoding = ""

                    decfield.html(decoded)
                    read.html(8-decoding.length)
                }
            } else {
                leftEl.css("background-color", "transparent")
                rightEl.css("background-color", "transparent")
            }

            // Listen for the SYN header
            if (oldhz != hz && hz>1250){
                SYNb.push(hz);
            }

            // Check if SYNb contains the SYN header
            if (SYNb[SYNb.length-3]>SYNb[SYNb.length-2] &&
                SYNb[SYNb.length-2]>SYNb[SYNb.length-1]){
                
                // Calculate correction offset
                correctionOffset = 0
                correctionOffset += Math.abs(SYNb[SYNb.length-3]-1800)
                correctionOffset += Math.abs(SYNb[SYNb.length-2]-1600)
                correctionOffset += Math.abs(SYNb[SYNb.length-1]-1400)
                correctionOffset /= 3
                correctionOffset = Math.floor(correctionOffset)

                console.log("SYN detected")
                console.log("correction offset "+correctionOffset)

                SYNb = []
            }

            freq.html(hz)
            oldhz = hz;

        }
    })
});