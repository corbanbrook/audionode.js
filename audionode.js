function AudioNode() {
  var _sampleRate;

  this.inputs = [];
  this.outputs = [];

  this.connect = function(destination, output, input) {
    output = output || 0; // output of this AudioNode
    input  = input  || 0; // input of destination AudioNode

    this.outputs[output] = destination;
    destination.inputs[input] = this;
  };

  this.disconnect = function(output) {
    output = output || 0;
    if (this.outputs[output] !== undefined) {
      delete this.outputs[output];
    }
  };

  this.__defineGetter__('numberOfInputs', function() { return inputs.length; });
  this.__defineGetter__('numberOfOutputs', function() { return outputs.length; });
  this.__defineGetter__('sampleRate', function() { return _sampleRate; });
}

function AudioContext() {
  var _contextStartTime = new Date();

  this.createBuffer = function(numberOfChannels, length, sampleRate) {};

  this.__defineGetter__('currentTime', function() { return new Date - _contextStartTime; });
}

function AudioElementSourceNode(audioElement) {
  this.audioAvailable = function(event) {
    // dispatch audio down the chain
    var frameBuffer = event.mozFrameBuffer;
    for (var i in outputs) {
      this.outputs[i].send(frameBuffer);
    }
  };

  audioElement.eventListener('audiowritten', this.audioAvailable, false);
}
AudioElementSourceNode.prototype = new AudioNode(); // AudioElementSourceNode inherits from AudioNode


