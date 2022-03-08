
let editor = ace.edit("editor");
let Range = ace.require("ace/range").Range;
editor.session.setMode("ace/mode/javascript");
editor.session.setUseWorker(false);

let compileButton = document.getElementById("compile");
let programErrorMessage = document.getElementById("programError");
let predictorErrorMessage = document.getElementById("predictorError");
let stepButton = document.getElementById("step");
let runButton = document.getElementById("run");
let runIterations = document.getElementById("iterations");

let parseProgram = module.exports.parse;
let verified = false;
let programAST = {};

editor.session.on("change", function () {
  verified = false;
  compileButton.disabled = false;
});

function verifyExpr(table, expr) {
  if (typeof expr === "string" && !(expr in table))
    return expr + " not defined";

  if (typeof expr !== "object") return null;

  let err = verifyExpr(table, expr.left);
  if (err) return err;

  err = verifyExpr(table, expr.right);
  if (err) return err;

  return null;
}

function verify(table, ast) {
  for (const stmt of ast) {
    if (Array.isArray(stmt)) {
      let newTable = Object.assign({}, table);
      let err = verify(newTable, ast);
      if (err) return err;
      continue;
    }

    if ("cond" in stmt) {
      let err = verifyExpr(table, stmt.cond);
      if (err) return err;
      let newTable = Object.assign({}, table);
      err = verify(newTable, stmt.body);
      if (err) return err;
      continue;
    }

    let err = verifyExpr(table, stmt.value);
    if (err) return err;
    table[stmt.name] = 0;
  }

  return null;
}

compileButton.onclick = function () {
  try {
    programAST = parseProgram(editor.getValue());
    let err = verify({ i: 0 }, programAST);
    if (err) {
      programErrorMessage.innerText = err;
      return;
    }
    programErrorMessage.innerText = "";
    verified = true;
    compileButton.disabled = true;
  } catch (e) {
    programErrorMessage.innerText = e.message;
  }
};


let currentIteration = 0;
let currentStatement = 0;
let currentBlock = programAST;
let currentStatementNesting = 0;
let currentTables = [ { i: 0 } ];

function nextIteration() {
  currentIteration++;
  currentTables = [{ i: currentIteration }];
  currentStatement = 0;
  currentBlock = programAST;
  currentStatementNesting = 0;
}

stepButton.onclick = function () {
  if (!verified) {
    predictorErrorMessage.innerText = "Compile first!";
    return;
  }
  predictorErrorMessage.innerText = "";

  if (currentStatement >= currentBlock.length) {
    if (currentStatementNesting === 0) {
      nextIteration();
      return;
    }
  }

  let currentTable = currentTables[currentTables.length - 1];
  let stmt = currentBlock[currentStatement];

  while (Array.isArray(stmt)) {
    let newTable = {};
    Object.assign(newTable, currentTable);
    currentTables.push(newTable);
    currentStatementNesting++;
    currentBlock = stmt;
    currentStatement = 0;

    currentTable = currentTables[currentTables.length - 1];
    stmt = currentBlock[currentStatement];
  }
};
