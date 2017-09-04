# 欢迎使用 canvas_mobile_drag
------
#### [点击查看demo（在移动端上查看）](https://htmlpreview.github.io/?https://github.com/xiaosu95/canvas_mobile_drag/blob/master/index.html)
该插件是一款脱离jq的移动端图片编辑器。可以应用在移动端H5页面或者微信小程序中。

> * 插件实现的功能为可页面内初始化载入图片、手动添加手机相册内的图片、或者添加服务器端的图片（服务器端需要开启允许图片跨域）。拥有多种的编辑模式。支持操作画布内的所有图片和单独设置某一种图片的状态或者位置等。
> * 插件操作模式支持手势放大、旋转；支持点击图片的四个角落拖拽放大或旋转或者。
> * 支持照片exif自动矫正。许多手机用不同方向拍照时会导致图片在canvas中显示角度不正常。常规解决方法是引入exif.js。不过该js大小太大。所以我在这里直接将exif获取角度的部分提取出来，大大精简了代码量。
> * 插件可输出你期望的分辨率图片，格式。
## API
* 开始使用
```javascript
var canvasBox = document.querySelector('#picBox');
var canvas = new _Canvas({
  box: canvasBox,                  // 容器
  bgColor: '#000',                // 背景色
  bgPhoto: 'none',                // 背景图
  photoModel: 'adaption',        // 载入图片模式(设置后添加图片时默认为当前设置模式)
  model: 'Cascade'                // 模式Cascade为添加的图片层级右添加顺序决定，autoHierarchy为层级由选中的图片为最高级
})
```
创建canvas为画布对象，调用初始化函数init(Object)
>* dragEvent、zoomEvent、rotateEvent分别是拖拽、缩放、旋转三个事件监听，传递2个参数（picArr, target）picArr为画布内的所有图片对象数组，target为当前操作的图片对象。
>* callback为'图片初始化完成的回调。
```javascript
canvas.init({
  dragEvent: function (picArr, target) {        // 监听拖拽事件
    console.log('当前操作事件：正在拖拽')
  },
  zoomEvent: function (picArr, target) {        // 监听缩放事件
    console.log('当前操作事件：正在缩放')
  },
  rotateEvent: function (picArr, target) {        // 监听旋转事件
    console.log('当前操作事件：正在旋转')
  },
  callback: function () {
    console.log('图片初始化完成...')
  }
});
```
* canvas画布的方法：

**toDataURL(Object)**
>* width: 输出的宽 (必须)；
>* height: 输出的高 (必须)；
>* type: 输出图片格式；
>* bgColor: 图片背景色（若设置了背景图则背景图的层级比背景色高）；
>* callback: 回调函数(传入参数为图片的baes64)若没有写callback则toDataURL会return图片的baes64；
```javascript
$('.outputmodel2').click(function () {
  canvas.toDataURL({
    width: 750,
    height: 600,
    type: 'image/png',
    callback: function (url) {
      $('.outputPic').attr('src', url);
      console.log('成功输出1倍png图')
    }
  })
})
```
**addPhoto(Object)**
>* url: 图片url（必须）;
>* model: 载入图片模式默认为'covered'铺满（为数字时为固定宽度，adaption为自适应显示）;
>* enable: 是否禁止编辑（Boolean）默认为false；
>* callback: 图片加载完的回调，参数为图片的对象;
```javascript
$('.addEnablePic').click(function () {
  canvas.addPhoto({
    url: './img/pic6.jpg',
    model: 200,
    enable: true,
    callback: function () {
      console.log('成功添加一张禁止编辑的图片')
    }
  })
})
```
**changeBg(Object)**
>* color: 背景色
>* photo: 背景图(url)//为'none'时移除背景图
```javascript
$('.bgColor').click(function () {
    var color = '#' + parseInt(Math.random() * 10) + parseInt(Math.random() * 10) + parseInt(Math.random() * 10)
      canvas.changeBg({
        photo: url,
        color: color
      })
    })
```
**changeParams(Object)**
>* width: '画布宽度',
>* height:  '画布高度',
>* model:  '画布模式' (模式Cascade为添加的图片层级由添加顺序决定，autoHierarchy为层级由选中的图片为最高级)

**getNowPhoto()**
>* return 当前操作的图片对象

**clearCanvas()**
>* 清空画布

* canvas画布的属性：

**photos：** 画布内所有图片对象

------
* Photo对象方法（画布内图片对象）

**init()**
>* 重置图片大小和位置

**getPhotoInfo()**
>* 返回图片的位置信息{model、enable、x（相对画布的x）、y（相对画布的y）、rotate、scale、width（画布内图片的宽度）、height（画布内图片的高度）、actualWidth（图片实际宽度）、actualHeight（图片实际高度）}

**changeInfo(Object)**
>* hierarchy: 层级(Number)
>* img: 图片URL(String)
>* rotate: 旋转角度(Number)
>* scale: 放大倍数(Number)
>* callback: 修改参数后的回调(Function)
```javascript
$('.changeUrl').click(function () {
  var nowPhoto = canvas.getNowPhoto();
  if (!nowPhoto) {
    alert('未选中任何图片');
    return;
  } else {
    var nowPhotoInfo = nowPhoto.getPhotoInfo();
    nowPhoto.changeInfo({
      img: './img/pic7.jpg',
      scale: nowPhotoInfo.scale / 1.1,
      hierarchy: 1,
      rotate: nowPhotoInfo.rotate + 90,
      callback: function () {
        console.log('成功修改')
      }
    })
  }
})
```

**_delete()**
>* 删除该图片
