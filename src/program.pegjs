
{
  function reduceOp(acc, elem) {
    return { op: elem[1], left: acc, right: elem[3] };
  }
}

start
  = body:(_ statement _)* { return body.map(e => e[1]); }

statement
  = "{" _ body:(if_statement / let_statement)* _ "}" { return body; }
  / if_statement
  / let_statement

let_statement "let statement"
 = "let" _ name:identifier _ "=" _ value:expression _ ";" { return { name: name, value: value }; }

if_statement "if statement"
  = "if" _ "(" _ cond:expression _ ")" _ "{" _ body:statement* _ "}" {
    return { cond: cond, body: body }
  }

expression "expression"
  = logical_or
  / "(" _ exp:logical_or _ ")" { return exp; }

logical_or "logical or"
  = head:logical_and tail:(_ "||" _ logical_and)* { return tail.reduce(reduceOp, head); }

logical_and "logical and"
  = head:bitwise_or tail:(_ "&&" _ bitwise_or)* { return tail.reduce(reduceOp, head); }

bitwise_or "bitwise or"
  = head:bitwise_xor tail:(_ "|" _ bitwise_xor)* { return tail.reduce(reduceOp, head); }

bitwise_xor "bitwise xor"
  = head:bitwise_and tail:(_ "^" _ bitwise_and)* { return tail.reduce(reduceOp, head); }

bitwise_and "bitwise and"
  = head:equality tail:(_ "&" _ equality)* { return tail.reduce(reduceOp, head); }

equality "equality"
  = head:compare tail:(_ ("==" / "!=") _ compare)* { return tail.reduce(reduceOp, head); }

compare "compare"
  = head:shift tail:(_ (">" / "<" / ">=" / "<=") _ shift)* { return tail.reduce(reduceOp, head); }


shift "shift"
  = head:additive tail:(_ (">>" / "<<") _ additive)* { return tail.reduce(reduceOp, head); }

additive "additive"
  = head:multiplicative tail:(_ ("+" / "-") _ multiplicative)* {
    return tail.reduce(reduceOp, head);
  }

multiplicative "multiplicative"
  = head:factor tail:(_ ("*" / "/" / "%") _ factor)* { return tail.reduce(reduceOp, head); }

factor "factor"
  = "(" _ expr:expression _ ")" { return expr; }
  / integer
  / identifier

integer "integer"
  = ([0-9]+ / ("0b" [01]+) / ("0x" [0-9a-fa-f]+) / ("0o" [0-7]+)) { return parseInt(text()); }

identifier "identifier"
  = [_a-zA-Z]([_a-zA-Z0-9])* { return text(); }

_ "whitespace"
  = [ \t\n\r]*
