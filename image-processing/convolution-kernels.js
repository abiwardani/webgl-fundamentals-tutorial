"use strict";

function main() {
  var image = new Image();
  image.src = "leaves.JPG";
  image.onload = function() {
    render(image);
  };
}

function render(image) {
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);

  var positionLocation = gl.getAttribLocation(program, "a_position");
  var texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  setRectangle( gl, 0, 0, image.width, image.height);

  var texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0,
  ]), gl.STATIC_DRAW);

  function createAndSetupTexture(gl) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
  }

  var originalImageTexture = createAndSetupTexture(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  var textures = [];
  var framebuffers = [];
  for (var ii = 0; ii < 2; ++ii) {
    var texture = createAndSetupTexture(gl);
    textures.push(texture);

    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);

    var fbo = gl.createFramebuffer();
    framebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }

  var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  var textureSizeLocation = gl.getUniformLocation(program, "u_textureSize");
  var kernelLocation = gl.getUniformLocation(program, "u_kernel[0]");
  var kernelWeightLocation = gl.getUniformLocation(program, "u_kernelWeight");
  var flipYLocation = gl.getUniformLocation(program, "u_flipY");

  var kernels = {
    normal: [
        0, 0, 0,
        0, 1, 0,
        0, 0, 0
    ],
    gaussianBlur: [
        0.045, 0.122, 0.045,
        0.122, 0.332, 0.122,
        0.045, 0.122, 0.045
    ],
    gaussianBlur2: [
        1, 2, 1,
        2, 4, 2,
        1, 2, 1
    ],
    gaussianBlur3: [
        0, 1, 0,
        1, 1, 1,
        0, 1, 0
    ],
    unsharpen: [
        -1, -1, -1,
        -1,  9, -1,
        -1, -1, -1
    ],
    sharpness: [
        0,-1, 0,
        -1, 5,-1,
        0,-1, 0
    ],
    sharpen: [
        -1, -1, -1,
        -1, 16, -1,
        -1, -1, -1
    ],
    edgeDetect: [
        -0.125, -0.125, -0.125,
        -0.125,  1,     -0.125,
        -0.125, -0.125, -0.125
    ],
    laplacian: [
        0,-1, 0,
        -1, 4,-1,
        0,-1, 0,
    ],
    horizontalLines: [
        -1, -1, -1,
        2,  2,  2,
        -1, -1, -1
    ],
    verticalLines: [
        -1, 2, -1,
        -1, 2, -1,
        -1, 2, -1
    ],
    diagonalLines1: [
        -1, -1,  2,
        -1,  2, -1,
        2, -1, -1
    ],
    diagonalLines2: [
        2, -1, -1,
        -1,  2, -1,
        -1, -1,  2
    ],
    horizontalSobel: [
        -1, -2, -1,
        0,  0,  0,
        1,  2,  1
    ],
    verticalSobel: [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
    ],
    boxBlur: [
        0.111, 0.111, 0.111,
        0.111, 0.111, 0.111,
        0.111, 0.111, 0.111
    ],
    triangleBlur: [
        0.0625, 0.125, 0.0625,
        0.125,  0.25,  0.125,
        0.0625, 0.125, 0.0625
    ],
    emboss: [
        -2, -1,  0,
        -1,  1,  1,
        0,  1,  2
    ]
  };

  var effects = [
    { name: "gaussianBlur", on: true },
    { name: "gaussianBlur2", },
    { name: "gaussianBlur3", },
    { name: "sharpness", },
    { name: "sharpen", on: true},
    { name: "unsharpen", },
    { name: "edgeDetect", },
    { name: "laplacian", },
    { name: "horizontalLines", },
    { name: "verticalLines", },
    { name: "diagonalLines1", },
    { name: "diagonalLines2", },
    { name: "horizontalSobel", },
    { name: "verticalSobel", },
    { name: "boxBlur", },
    { name: "triangleBlur", },
    { name: "emboss", on: true }
  ];

  var ui = document.querySelector("#ui");
  var table = document.createElement("table");
  var tbody = document.createElement("tbody");
  for (var ii = 0; ii < effects.length; ++ii) {
    var effect = effects[ii];
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    var chk = document.createElement("input");
    chk.value = effect.name;
    chk.type = "checkbox";
    if (effect.on) {
        chk.checked = "true";
    }
    chk.onchange = drawEffects;
    td.appendChild(chk);
    td.appendChild(document.createTextNode('≡ ' + effect.name));
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  ui.appendChild(table);
  $(table).tableDnD({onDrop: drawEffects});

  drawEffects();

  function computeKernelWeight(kernel) {
    var weight = kernel.reduce(function(prev, curr) {
        return prev + curr;
    });
    return weight <= 0 ? 1 : weight;
  }

  function drawEffects(name) {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    var size = 2;
    var type = gl.FLOAT;
    var normalize = false;
    var stride = 0;
    var offset = 0;
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);

    gl.enableVertexAttribArray(texcoordLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

    var size = 2;
    var type = gl.FLOAT;
    var normalize = false;
    var stride = 0;
    var offset = 0;
    gl.vertexAttribPointer(
        texcoordLocation, size, type, normalize, stride, offset);

    gl.uniform2f(textureSizeLocation, image.width, image.height);

    gl.bindTexture(gl.TEXTURE_2D, originalImageTexture);

    gl.uniform1f(flipYLocation, 1);

    var count = 0;
    for (var ii = 0; ii < tbody.rows.length; ++ii) {
      var checkbox = tbody.rows[ii].firstChild.firstChild;
      if (checkbox.checked) {
        setFramebuffer(framebuffers[count % 2], image.width, image.height);

        drawWithKernel(checkbox.value);

        gl.bindTexture(gl.TEXTURE_2D, textures[count % 2]);

        ++count;
      }
    }

    gl.uniform1f(flipYLocation, -1);
    setFramebuffer(null, gl.canvas.width, gl.canvas.height);
    drawWithKernel("normal");
  }

  function setFramebuffer(fbo, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.uniform2f(resolutionLocation, width, height);

    gl.viewport(0, 0, width, height);
  }


  function drawWithKernel(name) {
    gl.uniform1fv(kernelLocation, kernels[name]);
    gl.uniform1f(kernelWeightLocation, computeKernelWeight(kernels[name]));

    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);
  }
}

function setRectangle(gl, x, y, width, height) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2,
  ]), gl.STATIC_DRAW);
}

main();