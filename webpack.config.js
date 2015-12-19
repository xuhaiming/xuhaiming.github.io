module.exports = {
  entry: {
    main:"./src/main.jsx"
  },
  output: {
    filename: "./build/js/[name].bundle.js"
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: "style!css" },
      {
        test: /\.jsx?$/,
        exclude: /(node_modules)/,
        loader: 'babel',
        query:
        {
          presets:['react', 'es2015']
        }
      },
      {test: /\.scss$/, loaders: ["style", "css", "sass"]}
    ]
  }
};