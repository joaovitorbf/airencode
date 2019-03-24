function textToBin(text) {
    var length = text.length,
        output = [];
    for (var i = 0;i < length; i++) {
        if (text[i] == " "){
            output.push("0")
            continue
        }
      var bin = (text[i].charCodeAt()-64).toString(2);
      output.push(bin.split("").join("-"));
    } 
    return output.join("=");
}

function playChar(char, src, callback){
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

function calculateHertz (frequencies, options) {
    var rate = 22050 / 1024; // defaults in audioContext.
  
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

$(document).ready(function(){

    //Encoder
    var osc = new Tone.Oscillator({
        "type" : "sine",
        "frequency" : 450,
        "volume" : 0
    }).toMaster();



    $("#sendbtn").click(function(){
        var binCode = "-    S Y N ="+textToBin($("#txtinpt").val().toUpperCase())+"= S Y N   -";
        console.log("Modulating " + binCode)
        var cnt = 0;
        var loop = setInterval(function(){
            if (cnt < binCode.length+2){
                playChar(binCode[cnt], osc);
                cnt++;
            } else {
                clearInterval(loop);
                osc.stop()
            }
        },100)

    })

    //Decoder
    navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false,
            noiseSupression: false,
            autoGainControl:false},
        video: false})
    .then(function(stream){
        var context = new AudioContext();

        var source = context.createMediaStreamSource(stream);
        var analyzer = context.createAnalyser();
        var processor = context.createScriptProcessor(1024, 1, 1)

        var frequencies = new Float32Array(analyzer.frequencyBinCount);

        source.connect(analyzer);
        source.connect(processor);
        processor.connect(context.destination)

        var leftEl = $("#350")
        var rightEl = $("#550")
        var read = $("#read")
        var decfield = $("#decoded")
        var freq = $("#freq")

        var oldhz = 0;
        var decoding = ""
        var decoded = ""

        var correctionOffset = 0

        var SYNb = []
        processor.onaudioprocess = function(e){
            analyzer.getFloatFrequencyData(frequencies);
            var hz = Math.round(calculateHertz(frequencies, {rate: 24000/1024}))+correctionOffset;
            

            if (hz > 350 && hz < 550){
                if (oldhz != hz){
                    decoding += "0"
                    leftEl.css("background-color", "green")
                    rightEl.css("background-color", "transparent")
                    
                    read.html(6-decoding.length)
                }
            } else if (hz > 750 && hz < 950) {
                if (oldhz != hz){
                    decoding += "1"
                    rightEl.css("background-color", "green")
                    leftEl.css("background-color", "transparent")
                    
                    read.html(6-decoding.length)
                }
            } else if (hz > 1000) {
                if (oldhz != hz){
                    if (decoding == "0"){
                        decoded += " "
                    }
                    else {
                        decoded += String.fromCharCode((parseInt(decoding,2)+64).toString(10))
                    }
                    decoding = ""
                    decfield.html(decoded)
                    
                    read.html(8-decoding.length)
                }
            } else {
                leftEl.css("background-color", "transparent")
                rightEl.css("background-color", "transparent")
            }

            freq.html(hz)

            if (oldhz != hz && hz>1250){
                SYNb.push(hz);
            }

            if (SYNb[SYNb.length-3]>SYNb[SYNb.length-2] &&
                SYNb[SYNb.length-2]>SYNb[SYNb.length-1]){

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

            oldhz = hz;


        }

    })

});