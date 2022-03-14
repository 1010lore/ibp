const editor = ace.edit("editor");
const Range = ace.require("ace/range").Range;
editor.session.setMode("ace/mode/javascript");
editor.session.setUseWorker(false);

function clearMarkers() {
  const markers = editor.session.getMarkers();
  if (!markers) return;
  for (let marker of Object.keys(markers))
    editor.session.removeMarker(markers[marker].id);
}

const compileButton = document.getElementById("compile");
const programErrorMessage = document.getElementById("programError");
const predictorErrorMessage = document.getElementById("predictorError");
const stepButton = document.getElementById("step");
const runButton = document.getElementById("run");
const resetButton = document.getElementById("reset");
const runIterations = document.getElementById("iterations");
const iterationLabel = document.getElementById("iterationLabel");
const inM = document.getElementById("M");
const inN = document.getElementById("N");
const inP = document.getElementById("P");
const updateButton = document.getElementById("update");
const predictorView = document.getElementById("table");
const SRView = document.getElementById("SR");
const lastPredictionLabel = document.getElementById("lastPrediction");
const pcLabel = document.getElementById("PC");
const totalBranchesLabel = document.getElementById("totalBranches");
const correctPredictionsLabel = document.getElementById("correctPredictions");
const accuracyLabel = document.getElementById("accuracy");
const accuracyTable = document.getElementById("accuracyTable");
const resetAccuracyButton = document.getElementById("resetAccuracy");

const parseProgram = module.exports.parse;
let verified = false;
let programAST = [];
let currentIteration = 0;
let evaluationContextStack = [];
let predictorTables = [];
let M = 4;
let SRWidth = 1;
let SR = 0;
let totalBranches = 0;
let correctPredictions = 0;
let pcBranches = {};
let pcCorrectPredictions = {};

function updateIteration(i) {
  currentIteration = i;
  iterationLabel.innerText = `i = ${i}`;
}

editor.session.on("change", function () {
  if (verified) {
    updateIteration(0);
    evaluationContextStack = [];
    clearMarkers();
  }
  verified = false;
  compileButton.disabled = false;
});

function verifyExpr(table, expr) {
  if (typeof expr === "string" && !(expr in table))
    return expr + " not defined";

  if (typeof expr !== "object") return null;

  if ("arg" in expr) return verifyExpr(table, expr.arg);
  if ("unOp" in expr) return verifyExpr(table, expr.operand);

  let err = verifyExpr(table, expr.left);
  if (err) return err;

  err = verifyExpr(table, expr.right);
  if (err) return err;

  return null;
}

function verify(table, ast) {
  for (const stmt of ast) {
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
    evaluationContextStack = [
      { table: { i: 0 }, statement: 0, block: programAST },
    ];

    if (programAST.length > 0) {
      editor.session.addMarker(
        new Range(
          programAST[0].loc.start.line - 1,
          0,
          programAST[0].loc.end.line - 1,
          1
        ),
        "line-marker",
        "fullLine"
      );
      pcLabel.innerText = programAST[0].loc.start.line;
    }
  } catch (e) {
    programErrorMessage.innerText = e.message;
  }
};

function displayAccuracy() {
  totalBranchesLabel.innerText = totalBranches.toString();
  correctPredictionsLabel.innerText = correctPredictions.toString();
  if (totalBranches > 0)
    accuracyLabel.innerText = (correctPredictions / totalBranches).toFixed(3);
  else accuracyLabel.innerText = "?";

  accuracyTable.innerHTML = "";
  if (Object.keys(pcBranches).length === 0) return;

  let headerRow = accuracyTable.insertRow();
  headerRow.insertCell(0).innerText = "PC";
  headerRow.insertCell(1).innerText = "Branches";
  headerRow.insertCell(2).innerText = "Correct Predictions";
  headerRow.insertCell(3).innerText = "Accuracy";

  for (const pc of Object.keys(pcBranches)) {
    let cp = 0;
    if (pc in pcCorrectPredictions) cp = pcCorrectPredictions[pc];
    let row = accuracyTable.insertRow();
    row.insertCell(0).innerText = pc.toString();
    row.insertCell(1).innerText = pcBranches[pc].toString();
    row.insertCell(2).innerText = cp.toString();
    row.insertCell(3).innerText = (cp / pcBranches[pc]).toFixed(3);
  }
}

resetAccuracyButton.onclick = function () {
  totalBranches = 0;
  correctPredictions = 0;
  pcBranches = {};
  pcCorrectPredictions = {};
  displayAccuracy();
};

function nextIteration() {
  updateIteration(currentIteration + 1);
  evaluationContextStack = [
    { table: { i: currentIteration }, statement: 0, block: programAST },
  ];
}

function evalExpression(expr, table) {
  if (typeof expr === "number") return expr;
  if (typeof expr === "string") return table[expr];

  if ("arg" in expr) {
    let arg = evalExpression(expr.arg, table);
    let res = 0;
    if (arg > 0) res = Math.floor(Math.random() * arg);
    else res = Math.ceil(Math.random() * arg);
    return res;
  }

  if ("unOp" in expr) {
    let res = evalExpression(expr.operand, table);
    switch (expr.unOp) {
      case "!":
        return res === 0;
      case "~":
        return ~res;
    }
    throw new Error("Could not evaluate expression: " + JSON.stringify(expr));
  }

  let left = evalExpression(expr.left, table);
  let right = evalExpression(expr.right, table);

  switch (expr.op) {
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "%":
      return left % right;
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "<<":
      return left << right;
    case ">>":
      return left >> right;
    case "<":
      return left < right ? 1 : 0;
    case ">":
      return left > right ? 1 : 0;
    case "<=":
      return left <= right ? 1 : 0;
    case ">=":
      return left >= right ? 1 : 0;
    case "==":
      return left === right ? 1 : 0;
    case "!=":
      return left !== right ? 1 : 0;
    case "&":
      return left & right;
    case "^":
      return left ^ right;
    case "|":
      return left | right;
    case "&&":
      return left && right;
    case "||":
      return left || right;
  }

  throw new Error("Could not evaluate expression: " + JSON.stringify(expr));
}

function nextStatement(branchTaken) {
  let currentContext =
    evaluationContextStack[evaluationContextStack.length - 1];
  let stmt = currentContext.block[currentContext.statement];

  if ("cond" in stmt && branchTaken && stmt.body.length > 0) {
    let newContext = { table: {}, block: stmt.body, statement: 0 };
    Object.assign(newContext.table, currentContext.table);
    evaluationContextStack.push(newContext);
    return;
  }

  while (
    currentContext.block.length - 1 === currentContext.statement &&
    evaluationContextStack.length > 1
  ) {
    evaluationContextStack.pop();
    currentContext = evaluationContextStack[evaluationContextStack.length - 1];
  }

  if (currentContext.block.length - 1 > currentContext.statement) {
    currentContext.statement++;
    return;
  }

  nextIteration();
}

function predict(entry) {
  if (entry.type === "1") return entry.bits[0];
  return entry.bits[1];
}

function updatePredictorEntry(entry, branchTaken) {
  let bit = branchTaken ? 1 : 0;
  if (entry.type === "1") {
    entry.bits[0] = bit;
    return;
  }
  let predicted = entry.bits[1];
  if (predicted === bit) entry.bits[0] = entry.bits[1];
  else if (entry.bits[0] === entry.bits[1]) entry.bits[0] = bit;
  else {
    entry.bits[1] = bit;
    entry.bits[0] = 1 - bit;
  }
}

function runPredictor(pc, branchTaken) {
  totalBranches++;
  if (pc in pcBranches) pcBranches[pc]++;
  else pcBranches[pc] = 1;

  let table = predictorTables[SR];
  let entry = table[pc % M];
  let prediction = predict(entry) === 1;
  if (prediction === branchTaken) {
    correctPredictions++;
    if (pc in pcCorrectPredictions) pcCorrectPredictions[pc]++;
    else pcCorrectPredictions[pc] = 1;
    lastPredictionLabel.innerText = "Correct";
    lastPredictionLabel.style.background = "#0f0";
  } else {
    lastPredictionLabel.innerText = "Incorrect";
    lastPredictionLabel.style.background = "#f00";
  }

  updatePredictorEntry(entry, branchTaken);
  displayAccuracy();
}

function shiftRegister(branchTaken) {
  if (SRWidth === 0) return;
  let bit = branchTaken ? 1 : 0;
  SR = ((SR << 1) | bit) & ((1 << SRWidth) - 1);
}

function step() {
  if (!verified) {
    predictorErrorMessage.innerText = "Compile first!";
    return;
  }
  predictorErrorMessage.innerText = "";

  let currentContext =
    evaluationContextStack[evaluationContextStack.length - 1];
  if (currentContext.block.length === 0) return; // only possible if the AST is empty i.e there are no statements

  let stmt = currentContext.block[currentContext.statement];
  let branchTaken = false;
  if ("name" in stmt) {
    // let statement
    currentContext.table[stmt.name] = evalExpression(
      stmt.value,
      currentContext.table
    );
  } else {
    // if statement
    let cond = evalExpression(stmt.cond, currentContext.table);
    branchTaken = cond !== 0;
    runPredictor(stmt.loc.start.line, branchTaken);
    shiftRegister(branchTaken);
  }

  nextStatement(branchTaken);
  clearMarkers();

  currentContext = evaluationContextStack[evaluationContextStack.length - 1];
  stmt = currentContext.block[currentContext.statement];
  editor.session.addMarker(
    new Range(stmt.loc.start.line - 1, 0, stmt.loc.end.line - 1, 1),
    "line-marker",
    "fullLine"
  );
  pcLabel.innerText = stmt.loc.start.line;
  let predictorHighlight = null;
  if ("cond" in stmt) predictorHighlight = stmt.loc.start.line % M;
  displayPredictor(predictorHighlight);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

stepButton.onclick = step;
runButton.onclick = async function () {
  let iterations = runIterations.value;
  try {
    iterations = parseInt(iterations);
  } catch (e) {
    predictorErrorMessage.innerText = e.message;
    return;
  }

  if (iterations < 0) {
    predictorErrorMessage.innerText = "# iterations must be positive";
    return;
  }

  if (!verified) {
    predictorErrorMessage.innerText = "Compile first!";
    return;
  }

  predictorErrorMessage.innerText = "";

  let startIteration = currentIteration;
  while (currentIteration - startIteration < iterations) {
    step();
    await sleep(100);
  }
};

resetButton.onclick = function () {
  updateIteration(0);
  if (verified) {
    evaluationContextStack = [
      { table: { i: 0 }, statement: 0, block: programAST },
    ];
    clearMarkers();
    if (programAST.length > 0) {
      editor.session.addMarker(
        new Range(
          programAST[0].loc.start.line - 1,
          0,
          programAST[0].loc.end.line - 1,
          1
        ),
        "line-marker",
        "fullLine"
      );
      pcLabel.innerText = programAST[0].loc.start.line;
    }
  }
  updatePredictor();
  displayPredictor();
};

function updatePredictor() {
  let m = inM.value;
  let n = inN.value;
  let p = inP.value;

  try {
    m = parseInt(m);
    p = parseInt(p);
  } catch (e) {
    predictorErrorMessage.innerText = e.message;
    return;
  }

  if (m < 0 || p < 0) {
    predictorErrorMessage.innerText = "M and P must be positive";
    return;
  }

  predictorErrorMessage.innerText = "";

  let tableCount = 2 ** p;
  predictorTables = [];
  for (let i = 0; i < tableCount; ++i) {
    let table = [];
    for (let j = 0; j < m; ++j) table.push({ type: n, bits: [0, 0] });

    predictorTables.push(table);
  }

  SRWidth = p;
  SR = 0;
  M = m;
}

function displayPredictor(highlight) {
  predictorView.innerHTML = "";
  let headerRow = predictorView.insertRow();
  headerRow.insertCell(0).innerText = "PC";
  headerRow.insertCell(1).innerText = "Value";
  headerRow.insertCell(2).innerText = "Prediction";

  let table = predictorTables[SR];
  for (let i = 0; i < table.length; ++i) {
    let row = predictorView.insertRow();
    if (highlight === i) row.style.background = "#ff9";
    row.insertCell(0).innerText = i.toString();
    let valueCell = row.insertCell(1);
    if (table[i].type === "1")
      valueCell.innerText = table[i].bits[0].toString();
    else valueCell.innerText = `${table[i].bits[1]}${table[i].bits[0]}`;
    row.insertCell(2).innerText = predict(table[i]).toString();
  }

  SRView.innerText = (SR >>> 0).toString(2);
}

updatePredictor();
displayPredictor();
updateButton.onclick = function () {
  updatePredictor();
  displayPredictor();
};
