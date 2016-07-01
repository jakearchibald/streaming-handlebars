const gulp = require('gulp');
const gutil = require('gulp-util');
const webpack = require('webpack');
const webpackStream = require('webpack-stream');
const WebpackDevServer = require('webpack-dev-server');
const del = require('del');
const path = require('path');

const webpackOpts = {
  entry: './lib/index.js',
  output: {
    path: __dirname + "/dist/js",
    filename: 'index.js'
  },
  debug: true,
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
    }]
  },
  devtool: 'source-map',
  // https://github.com/wycats/handlebars.js/issues/953
  resolve: {
    modulesDirectories: ['node_modules', 'src'],
    fallback: path.join(__dirname, 'node_modules'),
    alias: {
      'handlebars': 'handlebars/dist/cjs/handlebars.js'
    }
  }
};

function clean() {
  return del(['dist']);
}

function copy() {
  return gulp.src('test-html/**')
    .pipe(gulp.dest('dist/'));
}

function js() {
  return gulp.src('lib/index.js')
    .pipe(webpackStream(webpackOpts))
    .pipe(gulp.dest('dist/js/'));
}

gulp.task("build", gulp.series(clean,
  gulp.parallel(copy, js)
));

gulp.task("serve", () => {
  // Start a webpack-dev-server
  const compiler = webpack(webpackOpts);
  const port = 3000;

  new WebpackDevServer(compiler, {
    stats: { colors: true },
    publicPath: "/js/",
    contentBase: "test-html"
  }).listen(port, "localhost", err => {
    if (err) throw new gutil.PluginError("serve", err);
    // Server listening
    gutil.log("[webpack-dev-server]", `http://localhost:${port}/webpack-dev-server/index.html`);
  });
});
