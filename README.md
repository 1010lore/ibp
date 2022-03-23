# IBP
IBP is the Interactive Branch Predictor. It simulates a [global history correlating branch predictor](https://en.wikipedia.org/wiki/Branch_predictor#Global_branch_prediction) that consists of multiple prediction tables indexed by a shift register that tracks branch history. 

- Design and mechanism of global history branch predictors: <https://1010labs.org/~ajaymt/branch-predictors>
- IBP interface documentation: <https://1010labs.org/~ajaymt/ibp/docs.html>

## Usage
To run IBP, install the PEG.js parser generator with `npm install` and then generate the parser with `npm run parser`.

To use IBP, open `src/index.html` with a web browser or start an HTTP server in the `src` directory.
