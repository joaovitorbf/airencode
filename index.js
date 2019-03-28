"use strict"

//-----------
// Utility functions
//-----------

// Convert text string to binary string
function textToBin(text, charcodes) {
    var length = text.length,
        output = []
    for (var i = 0; i < length; i++) {
        if (charcodes[text[i]]) {
            var bin = charcodes[text[i]]
            output.push(bin.split("").join("-"))
        } else {
            output.push("1-0-1-0-1-0")
        }
    }
    return output.join("=")
}

// Play the shound of a character
// 0 and 1 are for the binary numbers
// - is the digit separator
// = is the letter separator
// S, Y and N are offset sync characters
function playChar(char, src, callback) {
    // don't really know why changing this switch to an object literal lookup
    // breaks stuff, so I will keep it as as switch case
    switch (char) {
        case "1":
            src.frequency.value = 850
            break
        case "0":
            src.frequency.value = 450
            break
        case "-":
            src.frequency.value = 650
            break
        case "=":
            src.frequency.value = 1200
            break
        case "S":
            src.frequency.value = 1800
            break
        case "Y":
            src.frequency.value = 1600
            break
        case "N":
            src.frequency.value = 1400
            break
    }
    src.start("+0.15")
}

// Find the main frequency in the frequency data
function calculateHertz(frequencies, options) {
    var rate = 22050 / 1024

    if (options) {
        if (options.rate) {
            rate = options.rate
        }
    }

    var maxI, max = frequencies[0]

    for (var i = 0; frequencies.length > i; i++) {
        var oldmax = parseFloat(max)
        var newmax = Math.max(max, frequencies[i])
        if (oldmax != newmax) {
            max = newmax
            maxI = i
        }
    }
    return maxI * rate
}


// On document ready
function ready(fn) {
    if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading") {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}



//-----------
// Main code
//-----------

ready(function () {

    // Load charcodes
    var charcodes = {}
    var codechars = {}

    var request = new XMLHttpRequest()
    request.open("GET", "charcodes.json", true)

    request.onload = function () {
        if (this.status >= 200 && this.status < 400) {
            var data = JSON.parse(this.response)

            for (var i = 0; i < data.sequence.length; i++) {
                charcodes[data.sequence[i]] = (i + 1).toString(2)
                codechars[(i + 1).toString(2)] = data.sequence[i]
            }
            for (var key in data.specials) {
                charcodes[key] = data.specials[key]
                codechars[data.specials[key]] = key
            }

            document.getElementById("sendbtn").disabled = false
        }
    }

    request.send();

    // Encoder

    //Init Tone.js oscillator
    var osc = new Tone.Oscillator({
        "type": "sine",
        "frequency": 450,
        "volume": 0
    }).toMaster()


    // Start modulation
    document.getElementById("sendbtn").onclick = function () {
        var binCode = "-    S Y N =" + textToBin(document.getElementById("txtinpt").value, charcodes) + "= S Y N   -"
        console.log("Modulating " + binCode)

        // Loop through every character
        var cnt = 0
        var loop = setInterval(function () {
            if (cnt < binCode.length + 2) {
                playChar(binCode[cnt], osc)
                cnt++
            } else {
                clearInterval(loop)
                osc.stop()
            }
        }, 100) // delay between characters
    }

    // Decoder

    // Request user media permissions for recording audio
    navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            noiseSupression: false,
            autoGainControl: false
        },
        video: false
    })
        .then(function (stream) {

            // Starting context and nodes
            var context = new AudioContext()
            var source = context.createMediaStreamSource(stream)
            var analyzer = context.createAnalyser(); // For frequency analysis
            var processor = context.createScriptProcessor(1024, 1, 1) // For the audio processing ticks

            var frequencies = new Float32Array(analyzer.frequencyBinCount); // Frequency buffer array

            // Connect the microphone to the nodes
            source.connect(analyzer)
            source.connect(processor)
            processor.connect(context.destination)

            // JQuery elements
            var leftEl = document.getElementById("350")
            var rightEl = document.getElementById("550")
            var read = document.getElementById("read")
            var decfield = document.getElementById("decoded")
            var freq = document.getElementById("freq")

            // Aux variables
            var oldhz = 0
            var decoding = "" // current letter being decoded
            var decoded = "" // decoded message
            var correctionOffset = 0
            var SYNb = [] // SYN header buffer

            // Runs code on every audio processor tick
            processor.onaudioprocess = function (e) {

                // Get current frequency in hertz
                analyzer.getFloatFrequencyData(frequencies)
                var hz = Math.round(calculateHertz(frequencies, { rate: 24000 / 1024 })) + correctionOffset

                // Frequency range checks
                if (hz > 350 && hz < 550) {
                    if (oldhz != hz) { // Only if changed
                        decoding += "0"
                        leftEl.style.backgroundColor = "green"
                        rightEl.style.backgroundColor = "transparent"

                        read.innerHTML = 8 - decoding.length  // display countdown
                    }
                } else if (hz > 750 && hz < 950) {
                    if (oldhz != hz) {
                        decoding += "1"
                        rightEl.style.backgroundColor = "green"
                        leftEl.style.backgroundColor = "transparent"

                        read.innerHTML = 8 - decoding.length
                    }
                } else if (hz > 1000) { //letter separator
                    if (oldhz != hz) {
                        if (decoding == "0") {
                            decoded += " "
                        }
                        else {
                            if (codechars[decoding]) {
                                decoded += codechars[decoding]
                            }
                        }
                        decoding = ""

                        decfield.innerHTML = decoded
                        read.innerHTML = 8 - decoding.length
                    }
                } else {
                    leftEl.style.backgroundColor = "transparent"
                    rightEl.style.backgroundColor = "transparent"
                }

                // Listen for the SYN header
                if (oldhz != hz && hz > 1250) {
                    SYNb.push(hz)
                }

                // Check if SYNb contains the SYN header
                if (SYNb[SYNb.length - 3] > SYNb[SYNb.length - 2] &&
                    SYNb[SYNb.length - 2] > SYNb[SYNb.length - 1]) {

                    // Calculate correction offset
                    correctionOffset = 0
                    correctionOffset += Math.abs(SYNb[SYNb.length - 3] - 1800)
                    correctionOffset += Math.abs(SYNb[SYNb.length - 2] - 1600)
                    correctionOffset += Math.abs(SYNb[SYNb.length - 1] - 1400)
                    correctionOffset /= 3
                    correctionOffset = Math.floor(correctionOffset)

                    console.log("SYN detected")
                    console.log("correction offset " + correctionOffset)

                    SYNb = []
                }

                hz ? freq.innerHTML = hz : freq.innerHTML = 0
                oldhz = hz

            }
        })
});