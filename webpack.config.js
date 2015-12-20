var CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');

module.exports = {
    entry: {
        main: "./src/main.jsx",
        blogs: "./src/blogs/blogs.jsx"
    },
    output: {
        filename: "./build/js/[name].bundle.js"
    },
    module: {
        loaders: [
            {test: /\.css$/, loader: "style!css"},
            {
                test: /\.jsx?$/,
                exclude: /(node_modules)/,
                loader: 'babel',
                query: {
                    presets: ['react', 'es2015']
                }
            },
            {test: /\.scss$/, loaders: ["style", "css", "sass"]}
        ]
    },
    plugin: [
        new CommonsChunkPlugin({
                name: "commons",
                filename: "./build/js/common.js"
            }
        )
    ]
};