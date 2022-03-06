
let editor = ace.edit("editor");
editor.session.setMode("ace/mode/javascript");
editor.session.setUseWorker(false);

let parseProgram = module.exports.parse;

let compileButton = document.getElementById("compile");
compileButton.onclick = function () {
  console.log(parseProgram(editor.getValue()));
};
