/**
*作者:xiaosu
*Canvas为画布对象传入参数：{box:'容器', model:'模式', photoModel: '图片的模式', bgColor:'背景颜色'};
*  model：为图片层级的关系，模式Cascade为添加的图片层级右添加顺序决定，autoHierarchy为层级由选中的图片为最高级
*  photoModel： 载入图片的模式，默认为铺满，为数字时为固定宽度，adaption为自适应
*  bgColor： 画布背景图
*init方法:参数为：{dragEvent：'拖拽事件', zoomEvent: '缩放事件', rotateEvent: '旋转事件', callback: '回调'}回调为初始化加载完成回调参数为图片对象数组，其余事件返回图片对象数组和操作的的图片（事件仅手势触发）
*toDataURL方法：参数为{width:'输出的宽', height: '输出的高', type:'输出图片格式', canvasBg:'图片背景', cb:'回调函数传入图片beas64'} 没有回调则return图片beas64
*               canvasBg：输出的图片背景默认为白色；
*addPhoto方法: 参数为{url:'图片url', model:'载入图片模式', callback:'图片加载完的回调，参数为图片的对象'}；
*               model：载入图片的模式，默认为铺满，为数字时为固定宽度，adaption为自适应，enable：是否禁止编辑
*changeBg方法：更换背景图，参数{color:'背景色', photo:'背景图'}//photo='none'时，为移除背景背景以宽度100%载入
*changeParams方法：修改画布参数({width:'画布宽度', height: '画布高度', model: '画布模式'})
*getNowPhoto方法: 获取当前操作的图片对象
*clearCanvas方法: 清空画布
*photos属性：画布内所有图片对象
*
*Photo对象：_delete方法可以删除该对象；
*          init方法可以重置图片大小和位置
*          changeInfo(obj)方法修改图片的信息可以修改hierarchy、img、rotate、scale、callback；
*          enable属性为图片是否禁止编辑
*          getPhotoInfo方法： 返回图片的位置信息
**/
(function (window,document){
  var REGEXP_DATA_URL = /^data:/;
  var REGEXP_DATA_URL_JPEG = /^data:image\/jpeg.*;base64,/;
  var IS_SAFARI_OR_UIWEBVIEW = navigator && /(Macintosh|iPhone|iPod|iPad).*AppleWebKit/i.test(navigator.userAgent);
  var fromCharCode = String.fromCharCode;

/****************辅助函数********************************************/
  // 获取jpg图片的exif的角度（在ios体现最明显）
  function getOrientation(arrayBuffer) {
    var dataView = new DataView(arrayBuffer);
    var length = dataView.byteLength;
    var orientation;
    var exifIDCode;
    var tiffOffset;
    var firstIFDOffset;
    var littleEndian;
    var endianness;
    var app1Start;
    var ifdStart;
    var offset;
    var i;
    // Only handle JPEG image (start by 0xFFD8)
    if (dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xD8) {
      offset = 2;
      while (offset < length) {
        if (dataView.getUint8(offset) === 0xFF && dataView.getUint8(offset + 1) === 0xE1) {
          app1Start = offset;
          break;
        }
        offset++;
      }
    }
    if (app1Start) {
      exifIDCode = app1Start + 4;
      tiffOffset = app1Start + 10;
      if (getStringFromCharCode(dataView, exifIDCode, 4) === 'Exif') {
        endianness = dataView.getUint16(tiffOffset);
        littleEndian = endianness === 0x4949;

        if (littleEndian || endianness === 0x4D4D /* bigEndian */) {
          if (dataView.getUint16(tiffOffset + 2, littleEndian) === 0x002A) {
            firstIFDOffset = dataView.getUint32(tiffOffset + 4, littleEndian);

            if (firstIFDOffset >= 0x00000008) {
              ifdStart = tiffOffset + firstIFDOffset;
            }
          }
        }
      }
    }
    if (ifdStart) {
      length = dataView.getUint16(ifdStart, littleEndian);

      for (i = 0; i < length; i++) {
        offset = ifdStart + i * 12 + 2;
        if (dataView.getUint16(offset, littleEndian) === 0x0112 /* Orientation */) {

          // 8 is the offset of the current tag's value
          offset += 8;

          // Get the original orientation value
          orientation = dataView.getUint16(offset, littleEndian);

          // Override the orientation with its default value for Safari (#120)
          if (IS_SAFARI_OR_UIWEBVIEW) {
            dataView.setUint16(offset, 1, littleEndian);
          }
          break;
        }
      }
    }
    return orientation;
  }
  // ArrayBuffer对象 Unicode码转字符串
  function getStringFromCharCode(dataView, start, length) {
    var str = '';
    var i;
    for (i = start, length += start; i < length; i++) {
      str += fromCharCode(dataView.getUint8(i));
    }
    return str;
  }
  // base64转ArrayBuffer对象
  function base64ToArrayBuffer(base64, contentType) {
    // contentType = contentType || base64.match(/^data\:([^\;]+)\;base64,/mi)[1] || ''; // e.g. 'data:image/jpeg;base64,...' => 'image/jpeg'
    base64 = base64.replace(/^data\:([^\;]+)\;base64,/gmi, '');
    var binary = atob(base64);
    var len = binary.length;
    var buffer = new ArrayBuffer(len);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  // 排序规则
  function sortFun (a, b) {
    return a.hierarchy - b.hierarchy;
  }
  // 画直线
  function drawDashLine (context, x1, y1, x2, y2, dashLen) {     // 画虚线
    context.beginPath();
    dashLen = dashLen === undefined ? 5 : dashLen;
    // 得到斜边的总长度
    var beveling = getBeveling(x2 - x1, y2 - y1);
    // 计算有多少个线段
    var num = Math.floor(beveling / dashLen);
    for (var i = 0; i < num; i++) {
      context[i % 2 === 0 ? 'moveTo' : 'lineTo'](x1 + (x2 - x1) / num * i, y1 + (y2 - y1) / num * i);
    }
    context.stroke();
    function getBeveling (x, y) {       // 求斜边长度
      return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    }
  }
  // 渲染画布
  function rendering (ctx, ele) {
    // 切换画布中心点->旋转画布->切回画布原来中心点// 此时画布已经旋转过
    ctx.translate(ele.x + ele.width / 2, ele.y + ele.height / 2);
    ctx.rotate(ele.rotate / 180 * Math.PI, ele.rotate / 180 * Math.PI);
    ctx.translate(-(ele.x + ele.width / 2), -(ele.y + ele.height / 2));
    // 放大
    ctx.scale(ele.scale, ele.scale);
    ctx.drawImage(ele.img, ele.x / ele.scale, ele.y / ele.scale);    // 不放大x和y
    // 缩回原来大小
    ctx.scale(1 / ele.scale, 1 / ele.scale);
    // 切换画布中心点->旋转画布->切回画布原来中心点// 将画布旋转回之前的角度
    ctx.translate(ele.x + ele.width / 2, ele.y + ele.height / 2);
    ctx.rotate(-ele.rotate / 180 * Math.PI, -ele.rotate / 180 * Math.PI);
    ctx.translate(-(ele.x + ele.width / 2), -(ele.y + ele.height / 2));
  }

  // 实现jq的offset()函数
  function $offset (ele) {
    var obj = {left: 0, top: 0};
    (function _offset (ele2) {
      if (ele2.offsetParent) {          // 有offsetParent的dom则继续算
        obj.left += ele2.offsetLeft;
        obj.top += ele2.offsetTop;
        _offset(ele2.offsetParent)
      }
    })(ele)
    return obj;
  }
/******************对象函数****************************************/
  // 画布对象
  function Canvas (obj) {
    this.canvas = document.createElement('canvas');
    this.width = obj.box.offsetWidth;
    this.height = obj.box.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.photos = [];
    this.box = obj.box;                   // 容器
    this.box.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.bgColor = obj.bgColor || '#fff';           // 背景颜色
    this.bgPhoto = obj.bgPhoto || false;            // 背景图url
    this.bgPhotoType = false;      // 是否有背景图
    this.targetPhoto = null;              // target图片
    this.disx = 0;                        // 触摸点与target图片左边的距离
    this.disy = 0;                        // 触摸点与target图片上边的距离
    this.isSet = false;                   // 是否触摸操作点
    this.photoModel = obj.photoModel || 'covered';     // 默认图片载入的模式
    this.model = obj.model || 'autoHierarchy';     // 模式Cascade为添加的图片层级右添加顺序决定，autoHierarchy为层级由选中的图片为最高级
  }
  Canvas.prototype.init = function (obj) {           // 初始话创建图片对象
    var self = this;
    // 加载背景图
    var url = this.bgPhoto;
    this.bgPhoto = new Image();
    this.bgPhoto.crossOrigin = 'anonymous';       // 跨域图片
    this.bgPhoto.addEventListener('load', function () {
      self.bgPhotoType = true;
      self.painting();
    });      // 添加事件
    // this.bgPhoto.addEventListener('error', function () {
    //   self.bgPhotoType = false;               // 加载图片失败不展示背景图
    // });      // 加载失败
    this.bgPhotoType && (this.bgPhoto.src = url);        // 无背景图直接初始化
    // 防止移动端拖动
    self.canvas.style.touchAction = 'none';
    self.canvas.style.WebkitUserSelect = 'none';
    self.canvas.style.WebkitUserDrag = 'none';
    var imgs = self.box.getElementsByTagName('img');
    self.ctx.lineWidth = 1;             // 画布线条宽度
    Array.prototype.forEach.call(imgs, function (ele) {       // 添加图片对象
      var photo = new Photo({
        canvas: self,
        ele: ele,
        model: self.photoModel
      });
      photo.init();
      self.photos.push(photo);
    });
    // 对监听的DOM进行一些初始化
    self.canvas.addEventListener('touchstart', function (e) {       // 设置事件
      e.preventDefault();       //阻止触摸时页面的滚动，缩放
    }, false);
    touch.on( self.canvas, 'dragstart tap hold', function (e) {
      self.touchstart(e);
    });
    touch.on( self.canvas, 'drag', function (e) {
      self.touchmove(e);
      obj.dragEvent && self.targetPhoto && obj.dragEvent(self.photos, self.targetPhoto);     // 拖拽事件监听
    });
    touch.on( self.canvas, 'pinchstart', function (e) {
      self.pinchstart(e);
    });
    touch.on( self.canvas, 'pinch', function (e) {
      self.gestureZoom(e);
      obj.zoomEvent && self.targetPhoto && obj.zoomEvent(self.photos, self.targetPhoto);     // 缩放事件监听
    });
    touch.on( self.canvas, 'rotate', function (e) {
      self.touchRotate(e);
      obj.rotateEvent && self.targetPhoto && obj.rotateEvent(self.photos, self.targetPhoto);     // 旋转事件监听
    });

    // self.painting();        // 渲染画布
    obj.callback && obj.callback(self.photos);                      // 初始化完成回调并返回图片对象数组
  }
  Canvas.prototype.painting = function () {       // 绘画
    var self = this;
    this.ctx.fillStyle = this.bgColor;                                    // 背景色
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);      // 清空画布
    if (this.bgPhotoType) {               // 画背景图
      var scale = this.canvas.width / this.bgPhoto.width;
      this.ctx.scale(scale, scale)
      this.ctx.drawImage(this.bgPhoto, 0, 0);       // 画布背景图
      this.ctx.scale(1 / scale, 1 / scale)
    }

    self.photos.sort(sortFun);
    self.photos.forEach(function (ele) {
      if (self.targetPhoto == ele) {
        self.targetPhoto.recalculate();
        rendering(self.ctx, ele);       // 渲染画布
        self.targetPhoto.drawSet();
      } else rendering(self.ctx, ele);       // 渲染画布
    })
  }
  Canvas.prototype.touchstart = function (e) {          // 触摸
    e.preventDefault();       //阻止触摸时页面的滚动，缩放
    var self = this;
    var touch = e.position;
    var x = e.type != 'dragstart' ? touch.x - $offset(this.box).left : touch.x;
    var y = e.type != 'dragstart' ? touch.y - $offset(this.box).top : touch.y;
    if (this.targetPhoto && this.targetPhoto.isOperation(x, y) && this.targetPhoto.setSpot.type == this.targetPhoto.setSpot.deleteBut) {
      this.targetPhoto._delete();
      return;
    }
    this.isSet = false;
    this.targetPhoto = this.photos.filter(function (ele) {          // 获取点击的图片
      return ele.boundary(x, y);        // 判断是否在图片内
    }).pop();
    if (this.targetPhoto) {
      this.disx = x - this.targetPhoto.x;
      this.disy = y - this.targetPhoto.y;
      if (this.model == 'autoHierarchy') this.changeHierarchy(this.targetPhoto);     // 更改层级
      this.painting();
      // 是否点击了设置点
      if (this.targetPhoto.isOperation(x, y)) this.isSet = true;
    }
  }
  Canvas.prototype.touchmove = function (e) {           // 移动
    e.preventDefault();       //阻止触摸时页面的滚动，缩放
    var touch = e.position;
    var x = touch.x;
    var y = touch.y;
    if (this.targetPhoto) {
      if (this.isSet) {     // 放大旋转模式
        if (this.targetPhoto.setSpot.type == this.targetPhoto.setSpot.deleteBut) return;       // 删除按钮
        // 旋转
        this.targetPhoto.changeRotate(x, y);
        // 缩放
        this.targetPhoto.changeSize(x, y);
      } else {              // 移动模式
        this.targetPhoto.move(x - this.disx, y - this.disy);
      }
      this.painting();
    }
  }
  // 多点触控开始
  Canvas.prototype.pinchstart = function (e) {
    var self = this, touchPoints = [];
    Array.prototype.forEach.call(e.detail.originEvent.touches, function (ele, idx) {      // 获取多个点的坐标
      touchPoints[idx] = {};
      touchPoints[idx].x = ele.pageX - $offset(self.canvas).left;
      touchPoints[idx].y = ele.pageY - $offset(self.canvas).top;
    })
    this.targetPhoto = this.photos.filter(function (ele) {          // 获取点击的图片
      var flag = true;
      touchPoints.forEach(function (ele2) {
        if (!ele.boundary(ele2.x, ele2.y)) flag = false;
      })
      return flag;
    }).pop() || null;
    if (this.targetPhoto) {
      this.targetPhoto.temporaryScale = this.targetPhoto.scale;
      this.targetPhoto.temporaryRotate = this.targetPhoto.rotate;
    };
    this.painting();
  }

  // 双指缩放
  Canvas.prototype.gestureZoom = function (e) {
    if (!this.targetPhoto) return;
    this.targetPhoto.scale = e.scale * this.targetPhoto.temporaryScale;
    this.targetPhoto.obtainInfo();          // 重新获取位置信息
    this.painting();
  }
  // 旋转
  Canvas.prototype.touchRotate = function (e) {
    if (!this.targetPhoto) return;
    this.targetPhoto.rotate = e.rotation + this.targetPhoto.temporaryRotate;
    this.targetPhoto.obtainInfo();          // 重新获取位置信息
    this.painting();
  }
  // 重新定义图片层级
  Canvas.prototype.changeHierarchy = function (item) {
    item.hierarchy = this.photos.length;
    this.photos.sort(sortFun);
    this.photos.forEach(function (ele, idx) {
      ele.hierarchy = idx;
    })
  }
  /*添加图片传入参数为图片参数*/
  Canvas.prototype.addPhoto = function (obj) {
    var self= this;
    var newPhoto = new Image();
    newPhoto.crossOrigin = 'anonymous';       // 跨域图片
    newPhoto.src = obj.url;
    newPhoto.onload = function () {
      var photo = new Photo({
        canvas: self,
        ele: newPhoto,
        enable: obj.enable,
        model: obj.model || self.photoModel
      });
      self.photos.push(photo);
      photo.init(function (photo) {               // 加载图片完成的回调并返回图片对象
        obj.callback && obj.callback(photo)
        console.log(photo)
      });
    }
  }

  // 更换背景图
  Canvas.prototype.changeBg = function (bg) {
    var self = this;
    if (bg.color) {
      this.bgColor = bg.color;
      this.painting();
    }
    if (bg.photo == 'none') {             // 移除背景
      this.bgPhotoType = false;
      this.painting();
    } else {
      this.bgPhoto.src = bg.photo;
    }
  }
  // 更改画布参数
  Canvas.prototype.changeParams = function (obj) {
    if (obj.width) {
      this.box.style.width = obj.width + 'px';
      this.canvas.width = obj.width;
    }
    if (obj.height) {
      this.box.style.height = obj.height + 'px';
      this.canvas.height = obj.height;
    }
    if (obj.model) this.model = obj.model;
    this.painting();
  }

  // 清空画布
  Canvas.prototype.clearCanvas = function () {
    this.photos = [];
    this.targetPhoto = null;
    this.painting();
  }

  // 获取当前操作的图片
  Canvas.prototype.getNowPhoto = function () {
    return this.targetPhoto;
  }

  // 输出规定分辨率图片
  Canvas.prototype.toDataURL = function (obj) {
    var self = this;
    var type = obj.type || 'image/jpeg';
    if (!obj.width || !obj.height) {        // 默认为容器分辨率
      if (obj.callback) {
        obj.callback(this.canvas.toDataURL(type));      // 有回调则beas64在回调给
        return;
      }else return this.canvas.toDataURL(type);
    }
    var newCanvas = document.querySelector('#s_newCanvas');
    if (!newCanvas) {
      var newCanvas = document.createElement('canvas');
      newCanvas.id = 's_newCanvas';
    }
    var newScale = obj.width / this.width;       // 缩放比例以width为准
    newCanvas.width = obj.width;
    newCanvas.height = obj.height;
    newCanvas.style.display = 'none';
    this.box.appendChild(newCanvas);
    var newCtx = newCanvas.getContext("2d");
    if (!this.bgPhotoType){
      newCtx.fillStyle = obj.bgColor || this.bgColor;       // 背景色，没有的话和原画布一致
      newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);      // 清空画布
    } else {                                                // 画布背景图
      var bgScale = newScale * (this.canvas.width / this.bgPhoto.width);        // 背景图在合成图里的真正缩放比例，
      newCtx.scale(bgScale, bgScale);
      newCtx.drawImage(this.bgPhoto, 0, 0);
      newCtx.scale(1 / bgScale, 1 / bgScale);
    }
    self.photos.forEach(function (ele) {
      // 放大参数
      ele.changeScale(newScale)
      rendering(newCtx, ele);
      // 缩小参数
      ele.changeScale(1/newScale);
    })
    if (obj.callback) obj.callback(newCanvas.toDataURL(type));
    else return newCanvas.toDataURL(type);
  }


  // 图片对象
  function Photo (obj) {
    this.model = obj.model;      // 图片初始化的模式，默认为铺满'covered'，为数字时为宽度，adaption为自适应
    this.enable = obj.enable || false;        // 是否禁止编辑该照片默认为false
    this.x = 0;           // 中心点距离边界的x
    this.y = 0;           // 中心点距离边界的y
    this.rotate = 0;
    this.temporaryRotate = 0;        // 双指旋转时临时存储的旋转度数
    this.scale = 1;
    this.temporaryScale = 1;        // 双指缩放时临时存储的缩放前的比例
    this.width = 0;       // 画布内宽高
    this.height = 0;
    this.actualWidth = 0;        // 真实宽高
    this.actualHeight = 0;
    this.img = obj.ele;
    this.hierarchy = 0;     // 层级
    this._canvas = obj.canvas;
    this.coreX = 0;         // 中心坐标x
    this.coreY = 0;         // 中心坐标y
    this.setSpot = {        // 操作点的坐标
      w: 40,
      h: 40,
      deleteBut: 'topLeft',     // 删除按钮所在方位默认为左上角
      type: ''               // 类型点击的是具体哪个点（bottomLeft,bottomRight,topLeft,topRight）
    };
    this.oCoords = {};       // 四边的坐标
    this.realCorners = {};   // 四点真实坐标
    this.corners = null;     // 四点原始坐标
    this.actualRadius = 0;      // 实际半径
    this.radius = 0;         // 图片的半径
    this.originalRadius = 0; // 夹角
    this.hornLimit = {            // 图片的最大最小x,y坐标// 限制活动区域
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0
    }
    this.edgeLimit = {            // 图片在容器内触及边线时的x，y最小最大值
      minX: -Infinity,
      maxX: Infinity,
      minY: -Infinity,
      maxY: Infinity,
      flag: false,
      maxScale: Infinity
    }
  }
  Photo.prototype.init = function (cb) {        // 初始化// 回调返回图片对象
    var self = this;
    // 将层级提升到最高
    self.hierarchy = self._canvas.photos.length;
    // 隐藏图片
    self.img.style.display = 'none';
    this.actualWidth = this.img.width;        // 真实宽高
    this.actualHeight = this.img.height;
    this.actualRadius = Math.sqrt(Math.pow(this.actualWidth, 2) + Math.pow(this.actualHeight, 2)) / 2;      // 实际半径
    self.rotate = 0;
    this.getExif(function (exif) {
      // 根据exif旋转图片到正常
      if (exif == 6) {
        self.rotate = 90;
        self.setSpot.deleteBut = 'bottomLeft';
      }
      if (exif == 3) {
        self.rotate = 180;
        self.setSpot.deleteBut = 'bottomRight';
      }
      if (exif == 8) {
        self.rotate = 90;
        self.setSpot.deleteBut = 'topRight';
      }
      self.autoScale();       // 调节缩放比例
      cb && cb(self);           // 回调返回图片对象
    })
  }
  // 获取图片的arrayBuffer对象和获取图片的exif旋转系数
  Photo.prototype.getExif = function (cb) {
    var self = this;
    var url = this.img.src;
    var exif = null;
    var temp = 0;
    if (REGEXP_DATA_URL.test(url)) {
      return REGEXP_DATA_URL_JPEG.test(url) ? cb(getOrientation(base64ToArrayBuffer(url))) : cb(null);
    } else {
      xhr = new XMLHttpRequest();
      xhr.onload = function () {
        cb(getOrientation(this.response));
      };
      xhr.open('get', url);
      xhr.responseType = 'arraybuffer';
      xhr.send();
    }
  }
  // 图片载入时的模式，铺满，自适应，固定宽度
  Photo.prototype.autoScale = function () {
    if (this.model == 'covered') {        // 铺满
      if (this.rotate == 90 || this.rotate == -90) {
        if ((this.actualWidth / this.actualHeight) > (this._canvas.height / this._canvas.width)) {
          this.scale = (this._canvas.width / this.actualHeight);
        } else this.scale = (this._canvas.height / this.actualWidth);
      } else {
        if ((this.actualWidth / this.actualHeight) > (this._canvas.width / this._canvas.height)) {
          this.scale = (this._canvas.height / this.actualHeight);
        } else this.scale = (this._canvas.width / this.actualWidth);
      }
    } else if (this.model == 'adaption') {        // 自适应
      if (this.rotate == 90 || this.rotate == -90) {
        if ((this.actualWidth / this.actualHeight) > (this._canvas.height / this._canvas.width)) {
          this.scale = (this._canvas.height / this.actualWidth);
        } else this.scale = (this._canvas.width / this.actualHeight);
      } else {
        if ((this.actualWidth / this.actualHeight) > (this._canvas.width / this._canvas.height)) {
          this.scale = (this._canvas.width / this.actualWidth);
        } else this.scale = (this._canvas.height / this.actualHeight);
      }
    } else {                                          // 固定宽度
      if (this.rotate == 90 || this.rotate == -90) {
        this.scale = this.model / this.actualHeight
      } else this.scale = this.model / this.actualWidth
    }
    this.x = (this._canvas.width - (this.actualWidth * this.scale)) / 2;
    this.y = (this._canvas.height - (this.actualHeight * this.scale)) / 2;
    this.recalculate();     // 初始化数据
    this._canvas.painting();      // 渲染画布
  }

  Photo.prototype.recalculate = function () {       // 重新计算图片的数据
    this.width = this.scale * this.actualWidth;
    this.height = this.scale * this.actualHeight;
    this.coreX = this.x + this.width / 2;
    this.coreY = this.y + this.height / 2;
    // 获取图片原始四点的坐标
    this.radius = Math.sqrt(Math.pow(this.width, 2) + Math.pow(this.height, 2)) / 2;     // 半径
    this.originalRadius = Math.atan(this.height / this.width) * 180 / Math.PI;     // 中心点正半轴与四角的夹角（0-90）
    this.corners = {
      bottomLeft: {                     // 分别为原始坐标x,y,与中心点正x轴的夹角/即未旋转的
        x: this.coreX - this.width / 2,
        y: this.coreY + this.height / 2,
        angle: this.originalRadius + 180
      },
      bottomRight: {
        x: this.coreX + this.width / 2,
        y: this.coreY + this.height / 2,
        angle: -this.originalRadius + 360
      },
      topRight: {
        x: this.coreX + this.width / 2,
        y: this.coreY - this.height / 2,
        angle: this.originalRadius
      },
      topLeft: {
        x: this.coreX - this.width / 2,
        y: this.coreY - this.height / 2,
        angle: -this.originalRadius + 180
      }
    }
    this.sideLine();
  }
  Photo.prototype.sideLine = function () {        // 获取图片四边的坐标ps：真正的坐标
    // 获取四角新的坐标运用公式为x1=x0+r*cos(ao*3.14/180)；
    //                        y1=y0-r*sin(ao*3.14/180)；//ao为与中心点正x轴的夹角（x0，y0）为中心坐标
    this.edgeLimit.minX = -Infinity;
    this.edgeLimit.maxX = Infinity;
    this.edgeLimit.minY = -Infinity;
    this.edgeLimit.maxY = Infinity;
    for (key in this.corners) {
      this.realCorners[key] = {
        x: this.coreX + Math.cos((this.corners[key].angle - this.rotate) / 180 * Math.PI) * this.radius,
        y: this.coreY - Math.sin((this.corners[key].angle - this.rotate) / 180 * Math.PI) * this.radius
      }
      this.edgeLimit.minX = Math.max(-Math.cos((this.corners[key].angle - this.rotate) / 180 * Math.PI) * this.radius - this.width / 2, this.edgeLimit.minX);
      this.edgeLimit.maxX = Math.min(this._canvas.width - Math.cos((this.corners[key].angle - this.rotate) / 180 * Math.PI) * this.radius - this.width / 2, this.edgeLimit.maxX);
      this.edgeLimit.minY = Math.max(Math.sin((this.corners[key].angle - this.rotate) / 180 * Math.PI) * this.radius - this.height / 2, this.edgeLimit.minY);
      this.edgeLimit.maxY = Math.min(this._canvas.height + Math.sin((this.corners[key].angle - this.rotate) / 180 * Math.PI) * this.radius - this.height / 2, this.edgeLimit.maxY);
      this.edgeLimit.flag = true;
    };
    // 确定图片四条边的坐标
    this.oCoords.bottomLine = {
      o: this.realCorners.bottomLeft,
      d: this.realCorners.bottomRight
    }
    this.oCoords.RightLine = {
      o: this.realCorners.bottomRight,
      d: this.realCorners.topRight
    }
    this.oCoords.topLine = {
      o: this.realCorners.topRight,
      d: this.realCorners.topLeft
    }
    this.oCoords.leftLine = {
      o: this.realCorners.topLeft,
      d: this.realCorners.bottomLeft
    }
    // 获取图片最大最小坐标
    this.hornLimit.minX = Math.min(this.realCorners.bottomLeft.x, this.realCorners.bottomRight.x, this.realCorners.topRight.x, this.realCorners.topLeft.x);
    this.hornLimit.minY = Math.min(this.realCorners.bottomLeft.y, this.realCorners.bottomRight.y, this.realCorners.topRight.y, this.realCorners.topLeft.y);
    this.hornLimit.maxX = Math.max(this.realCorners.bottomLeft.x, this.realCorners.bottomRight.x, this.realCorners.topRight.x, this.realCorners.topLeft.x);
    this.hornLimit.maxY = Math.max(this.realCorners.bottomLeft.y, this.realCorners.bottomRight.y, this.realCorners.topRight.y, this.realCorners.topLeft.y);
    if (this.hornLimit.minX >=0 && this.hornLimit.minY >=0 && this.hornLimit.maxX <= this._canvas.width && this.hornLimit.maxY <= this._canvas.height) {
      this.edgeLimit.maxScale = Math.min((this.edgeLimit.maxX - this.edgeLimit.minX + this.width) / this.actualWidth, (this.edgeLimit.maxY - this.edgeLimit.minY + this.height) / this.actualHeight)
    }
  }
  Photo.prototype.boundary = function (x, y) {          // 判断是否在范围内且enable=false
    var xcount = 0;
    var xi, yi, a1, a2, b1, b2;
    for (var key in this.oCoords) {
      var iLine = this.oCoords[key];
      if ((iLine.o.y < y) && (iLine.d.y < y)) continue;     // 边线下面
      if ((iLine.o.y >= y) && (iLine.d.y >= y)) continue;   // 边线上面
      if ((iLine.o.x == iLine.d.x) && (iLine.o.x >= x)) {
				xi = iLine.o.x;
				yi = y;
			}
			// calculate the intersection point
			else {
				b1 = 0; //(y2-y)/(x2-x);
				b2 = (iLine.d.y - iLine.o.y) / (iLine.d.x - iLine.o.x);
				a1 = y - b1 * x;
				a2 = iLine.o.y - b2 * iLine.o.x;

				xi = - (a1 - a2) / (b1 - b2);
				yi = a1 + b1 * xi;
			}
			// dont count xi < x cases
			if (xi >= x) {
				xcount += 1;
			}
			// optimisation 4: specific for square images
			if (xcount == 2) {
				break;
			}
		}
    return (xcount % 2 && !this.enable);          // 为奇数说明在图片内且enable=false
  }

  Photo.prototype.isOperation = function (x, y) {        // 判断是否点击在四角的操作点上
    for (var key in this.realCorners) {
      var spot = this.realCorners[key];
      if (Math.abs(x - spot.x) < this.setSpot.w && Math.abs(y - spot.y) < this.setSpot.h) {
        this.setSpot.type = key;
        return true;
      }
    }
    return false;
  }
  Photo.prototype.drawSet = function () {          // 画操作按钮、边框
    var preSpot = null;
    var firstSpot = null;
    this._canvas.ctx.beginPath();
    this._canvas.ctx.fillStyle="#fff";
    this._canvas.ctx.arc(this.realCorners[this.setSpot.deleteBut].x, this.realCorners[this.setSpot.deleteBut].y, 20, 0, 2*Math.PI);
    this._canvas.ctx.fill();
    this._canvas.ctx.fillStyle="#000";
    this._canvas.ctx.textBaseline="middle";
    this._canvas.ctx.font="20px Arial";
    this._canvas.ctx.fillText("╳", this.realCorners[this.setSpot.deleteBut].x - 10, this.realCorners[this.setSpot.deleteBut].y);
    for (var key in this.realCorners) {
      var spot = this.realCorners[key];
      if (preSpot) {
        drawDashLine(this._canvas.ctx, preSpot.x, preSpot.y, spot.x, spot.y);  // 画边框
      }
      if (!firstSpot) firstSpot = this.realCorners[key];
      preSpot = spot;
    }
    drawDashLine(this._canvas.ctx, preSpot.x, preSpot.y, firstSpot.x, firstSpot.y);  // 画边框
  }
  // 删除图片
  Photo.prototype._delete = function () {
    var idx = this._canvas.photos.indexOf(this);
    this._canvas.photos.splice(idx, 1);
    this._canvas.targetPhoto = null;
    this._canvas.painting();        // 刷新画布
  }
  Photo.prototype.changeSize = function (x, y) {        // 放大缩小
    // 放大缩小
    var radius = Math.sqrt(Math.pow(x - this.coreX, 2) + Math.pow(y - this.coreY, 2));  // 放大后半径
    this.scale = (Math.abs(radius / this.actualRadius));      // 缩放倍数
    this.obtainInfo();
  }
  Photo.prototype.obtainInfo = function () {        // 重新计算图片的宽高和x、y
    this.width = this.scale * this.actualWidth;
    this.height = this.scale * this.actualHeight;
    this.x = this.coreX - this.width / 2;
    this.y = this.coreY - this.height / 2;
  }
  // 移动
  Photo.prototype.move = function (x, y) {
    this.x = x;
    this.y = y;
    // if (x < this.edgeLimit.minX) this.x = this.edgeLimit.minX;
    // else if (x > this.edgeLimit.maxX) this.x = this.edgeLimit.maxX;
    // else this.x = x;
    // if (y < this.edgeLimit.minY) this.y = this.edgeLimit.minY;
    // else if (y > this.edgeLimit.maxY) this.y = this.edgeLimit.maxY;
    // else this.y = y;
  }
  Photo.prototype.changeRotate = function (x, y) {        // 旋转
    // 旋转0->-360
    this.rotate = Math.atan(((y - this.coreY) / (x - this.coreX))) * 180 / Math.PI;
    // 在中心点右侧区域的角度需要减去中心正轴与右上角的夹角；左侧区域需要减去中心正轴与右上角的夹角的补角
    this.rotate = x > this.coreX ? (this.rotate - this.originalRadius) : (this.rotate - (180 + this.originalRadius));
    if (this.rotate > 0) this.rotate -= 360;
    // 点击不同位置的设置点修正其角度差
    // 角度差为与右下角与中心点和该角产生的角度
    if (this.setSpot.type == 'topRight') this.rotate += this.originalRadius * 2;
    if (this.setSpot.type == 'topLeft') this.rotate += 180;
    if (this.setSpot.type == 'bottomLeft') this.rotate += (this.originalRadius * 2 + 180);
  }

  Photo.prototype.changeScale = function (val) {          // 修改图片比例（生成不同分辨率画布使用）
    this.width *= val;
    this.height *= val;
    this.x *= val;
    this.y *= val;
    this.scale *= val;
  }

  // 更改图片的参数
  Photo.prototype.changeInfo = function (obj) {
    var self = this;
    obj.hierarchy && (this.hierarchy = obj.hierarchy);
    obj.rotate && (this.rotate = obj.rotate);
    obj.scale && (this.scale = obj.scale);
    if (obj.img) {
      var newPhoto = new Image();
      newPhoto.crossOrigin = 'anonymous';       // 跨域图片
      newPhoto.src = obj.img;
      newPhoto.onload = function () {
        self.img = newPhoto;
        self.init(obj.callback);
      }
    } else {
      this._canvas.painting();
      obj.callback && obj.callback();
    }
  }

  // 获取图片的信息
  Photo.prototype.getPhotoInfo = function () {
    return {
      model: this.model,
      enable: this.enable,
      x: this.x,
      y: this.y,
      rotate: this.rotate,
      scale: this.scale,
      width: this.widtn,
      height: this.height,
      actualWidth: this.actualWidth,
      actualHeight: this.actualHeight
    }
  }


  window._Canvas = Canvas;
})(window,document)
