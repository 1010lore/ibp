
let editor = ace.edit("editor");
editor.session.setMode("ace/mode/javascript");
editor.session.setUseWorker(false);

let compileButton = document.getElementById("compile");
compileButton.onclick = function () {
  console.log(peg$parse(editor.getValue()));
};
