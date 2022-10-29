function deleteFiles(files, callback) {
  if (files.length == 0) callback();
  else {
    var f = files.pop();
    fs.unlink(f, function (err) {
      if (err) callback(err);
      else {
        console.log(f + ' deleted.');
        deleteFiles(files, callback);
      }
    });
  }
}
module.exports = deleteFiles;

// deleteFiles(
//   product.images.map((x) => `/public/files/${x}`),
//   function (err) {
//     if (err) {
//       console.log(
//         'Product images not deleted',
//         product.id + ' : ' + product.name
//       );
//     }
//   }
// );
