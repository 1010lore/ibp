let editor = ace.edit("editor");
let Range = ace.require("ace/range").Range;
editor.session.setMode("ace/mode/javascript");
editor.session.setUseWorker(false);

function clearMarkers() {
  const markers = editor.session.getMarkers();
  if (!markers) return;
  for (let marker of Object.keys(markers))
    editor.session.removeMarker(markers[marker].id);
}

let compileButton = document.getElementById("compile");
let programErrorMessage = document.getElementById("programError");
let predictorErrorMessage = document.getElementById("predictorError");
let stepButton = document.getElementById("step");
let runButton = document.getElementById("run");
let runIterations = document.getElementById("iterations");

let parseProgram = module.exports.parse;
let verified = false;
let programAST = {};
let currentIteration = 0;
let evaluationContextStack = [
  { table: { i: 0 }, statement: 0, block: programAST },
];

editor.session.on("change", function () {
  if (verified) {
    currentIteration = 0;
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
    if (programAST.length > 0)
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
  } catch (e) {
    programErrorMessage.innerText = e.message;
  }
};

function nextIteration() {
  currentIteration++;
  evaluationContextStack = [
    { table: { i: currentIteration }, statement: 0, block: programAST },
  ];
}

function evalExpression(expr, table) {
  if (typeof expr === "number") return expr;
  if (typeof expr === "string") return table[expr];

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
      return left && right ? 1 : 0;
    case "||":
      return left || right ? 1 : 0;
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
