# canvas_mobile_drag
## 不依赖jq，支持多张图片多种模式编辑，图片四角除了一个删除，其余拖拽可缩放旋转；图片支持手势缩放旋转
[demo](https://htmlpreview.github.io/?https://github.com/xiaosu95/canvas_mobile_drag/blob/master/index.html)
* Canvas为画布对象传入参数：{box:'容器', model:'模式', photoModel: '图片的模式', bgColor:'背景颜色'};
  * model：为图片层级的关系，模式Cascade为添加的图片层级右添加顺序决定，autoHierarchy为层级由选中的图片为最高级
  * photoModel： 载入图片的模式，默认为铺满，为数字时为固定宽度，adaption为自适应
  * bgColor： 画布背景图
* init方法:参数为：{dragEvent：'拖拽事件', zoomEvent: '缩放事件', rotateEvent: '旋转事件', callback: '回调'}回调为初始化加载完成回调参数为图片对象数组，其余事件返回图片对象数组和操作的的图片（事件仅手势触发）
* toDataURL方法：参数为{width:'输出的宽', height: '输出的高', type:'输出图片格式', canvasBg:'图片背景', cb:'回调函数传入图片beas64'} 没有回调则return图片beas64,canvasBg：输出的图片背景默认为白色；
* addPhoto方法: 参数为{url:'图片url', model:'载入图片模式', callback:'图片加载完的回调，参数为图片的对象'}；model：载入图片的模式，默认为铺满，为数字时为固定宽度，adaption为自适应，enable：是否禁止编辑
* changeBg方法：更换背景图，参数{color:'背景色', photo:'背景图'}//photo='none'时，为移除背景背景以宽度100%载入
* changeParams方法：修改画布参数({width:'画布宽度', height: '画布高度', model: '画布模式'})
* getNowPhoto方法: 获取当前操作的图片对象
* clearCanvas方法: 清空画布
* photos属性：画布内所有图片对象
