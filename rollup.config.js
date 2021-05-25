import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";

export default {
  input: "index.js",
  output: {
      file: "dist/d3-lasso.js",
      format: "umd",
      name: "lasso",
      globals: {
        "d3-selection": "d3",
        "d3-drag": "d3",
        "robust-point-in-polygon": "classifyPoint"
      }
  },
  plugins: [
    nodeResolve({
        jsnext: true,
        main: true,
        browser: true,
        extensions: [".js", ".jsx"],
        skip: [ "node_modules/d3-selection", "node_modules/d3-drag", "node_modules/d3-dispatch" ]
      }),
    commonjs({
        include: "node_modules/**",
        exclude: [ "node_modules/d3-selection/"]
      })
  ]
};