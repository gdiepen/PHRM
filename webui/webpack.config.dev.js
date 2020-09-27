const path = require('path')


const { AddDependencyPlugin } =  require("webpack-add-dependency-plugin")
const {CleanWebpackPlugin} = require('clean-webpack-plugin')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const app_pages = [
	{
		page: 'index',
		description: '<span class="fa fa-home fa-lg"></span> Daily heart rate'
	},
	{
		page: 'contact',
		description: '<span class="fa fa-list fa-lg"></span> Heart rate over time'
	},
	{
		page: 'about',
		description: '<span class="fa fa-info fa-lg"></span> About'
	}
]

const app_pages_plugins = app_pages.map( function(page){
    return new HtmlWebpackPlugin({
            hash: true,
            template: "./src/pages/"+page.page+"/tmpl.ejs",
            inject: true,
            chunks: [page.page],
            pagename: page.page,
            filename: page.page+'.html',
            description: page.description,
            all_pages: app_pages
        })
})



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
    },


    plugins: [ new CleanWebpackPlugin ].concat(app_pages_plugins).concat(

    [new AddDependencyPlugin({ path: "./src/common/navbar.ejs" })]

    ).concat(
    [
new class DependencyGraphPlugin {
  apply(compiler) {
    compiler.hooks.emit.tap("DependencyGraphPlugin", (compilation) => {
      let deps = [];

      compilation.modules.forEach(m =>  {
        if (m.resource) {
          const file = path.relative('', m.resource)
          const issuer= m.issuer && m.issuer.resource && path.relative('', m.issuer.resource)

          if(file !== issuer){
            deps.push([issuer, file]);
          }
        }
        
      })
      // Insert this list into the webpack build as a new file asset:
      const source = `digraph sources {
        rankdir=LR;
        ${deps.map(d => `"${d[0]}" -> "${d[1]}";`).join('\n\t')} 
      }`;


    console.log(source)
      compilation.assets['graph.dot'] = {
        source: function() {
          return source;
        },
        size: function() {
          return source.length;
        }
      };
    })
  }
}

    ]



    ).concat([ new MiniCssExtractPlugin({ filename: '[name].css', })])

	/*
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
            filename: 'about.html',
	    option_asdf: "asdf",
		templateParameters:{
			'foo': 'bar'
		}


        }),
        new HtmlWebpackPlugin({
            template: './src/pages/contact/tmpl.ejs',
            inject: true,
            chunks: ['contact'],
            filename: 'contact.html'
        }),



        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),
    ],
    */

}
