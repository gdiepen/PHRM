const path = require('path')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const buildPath = path.resolve(__dirname, 'dist')

module.exports = {

  // This option controls if and how source maps are generated.
  // https://webpack.js.org/configuration/devtool/
  devtool: 'source-map',

  // https://webpack.js.org/concepts/entry-points/#multi-page-application
    entry: {
        index: './src/pages/index/main.js',
        about: './src/pages/about/main.js',
        compare_ranges: './src/pages/compare_ranges/main.js'
    },
  // how to write the compiled files to disk
  // https://webpack.js.org/concepts/output/
  output: {
    filename: '[name].[hash:20].js',
    path: buildPath
  },

  // https://webpack.js.org/concepts/loaders/

    module: {
        rules: [
            {
                test: /\.css$/,
                use: [ MiniCssExtractPlugin.loader, 'css-loader']
            },

            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },

            {
                // Load all images as base64 encoding if they are smaller than 8192 bytes
                test: /\.(png|jpe?g|gif|svg)$/i,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            // On development we want to see where the file is coming from, hence we preserve the [path]
                            name: '[path][name].[ext]?hash=[hash:20]',
                            esModule: false,
                            limit: 8192
                        }
                    }
                ]
            },


            {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/'
                        }
                    }
                ]
            },

        ]
    },








  // https://webpack.js.org/concepts/plugins/
    plugins: [
        new HtmlWebpackPlugin({
            template: 'ejs-compiled-loader?my_key=my_value2&foo=bar!./src/pages/index/tmpl.ejs',
            inject: true,
            chunks: ['index'],
            filename: 'index.html'

        }),
        new HtmlWebpackPlugin({
            aabbccddee: "foobar",
            template: './src/pages/about/tmpl.ejs',
            inject: true,
            chunks: ['about'],
            filename: 'about.html',
            options:{
                asdf: "qwerty"
            }
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/compare_ranges/tmpl.ejs',
            inject: true,
            chunks: ['compare_ranges'],
            filename: 'compare_ranges.html',
	    favWord: "computer"

        }),



        new MiniCssExtractPlugin({
            filename: './css/[name].css',
        }),
    ],

  // https://webpack.js.org/configuration/optimization/
  optimization: {
    splitChunks: {
	    chunks: 'all',
    },
    minimize: true,
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: false,
      }),
      new OptimizeCssAssetsPlugin({})
    ]
  }
}
