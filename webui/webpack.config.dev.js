const path = require('path')

const {CleanWebpackPlugin} = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');



module.exports = {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        contentBase: './dist',
        proxy: {
            '/api': {
                target: 'http://localhost:5002',
                secure: false,
            }
        }
    },


    entry: {
        index: './src/pages/index/main.js',
        about: './src/pages/about/main.js',
        contact: './src/pages/contact/main.js'
    },





    watchOptions:{
        ignored: [ '**/*.swp' , '*.swp' , 'node_modules/**' ]
    },

    plugins: [
        new CleanWebpackPlugin(),


        new HtmlWebpackPlugin({
            template: "./src/pages/index/tmpl.ejs",
            inject: true,
            chunks: ['index'],
            filename: 'index.html'
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/about/tmpl.ejs',
            inject: true,
            chunks: ['about'],
            filename: 'about.html'
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/contact/tmpl.ejs',
            inject: true,
            chunks: ['contact'],
            filename: 'contact.html'
        }),



        new MiniCssExtractPlugin({
            filename: 'combined_style.css',
        }),
    ],

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
                test: /\.ejs$/,
                use: {
                    loader: 'ejs-compiled-loader',
                    options: {
                        htmlmin: false,
                    }
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
    }


}
