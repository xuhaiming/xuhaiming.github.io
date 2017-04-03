Nowadays parallax effect is not something new for web application. However, with data binding and component based JavaScript, we can make it faster and easy to apply. This post is about how create simple parallax in Vue from stretch.

## HTML Design

To achieve the goal of parallax, we need at least two layers:

1. The container layer has fixed height and hidden overflow
2. The image layer has larger image than container height

```
<div class="parallax-container">
  <div class="parallax">
    <img src="..."/>
  </div>
</div>
```

In this case we can give the container a relative position and image an absolute position, so that we just need change the `top` property for the image. We need give image layer a lower z-index since it shows behind the container.

```
.parallax-container {
  height: 500px;
  position: relative;
  overflow: hidden;
}

.parallax {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: -1;
}
```

## Scroll Calculations

There are few factors could affact the scroll calculation:

- Window size
- Container size
- Image size
- Window scroll top position
- Container position

The edge points are shown as below:

1. When container top reaches the bottom of the window
2. When container bottom leave the top of the window

In order to provide the maximium parallax scroll effects, the image should show top part in point 1, and show bottom part in point 2.

We can register the scroll event when the component has been rendered:

```
window.addEventListener('scroll', this.scrollHandler)
```

Inside scroll handler we can calculate the image scroll top value based on the edge points. The value in between we can use image max scroll area multiply by scroll percentage:

```
const imageHeight = this.$el.querySelector('img').clientHeight
const containerHeight = this.$el.clientHeight
const windowHeight = window.innerHeight
const containerOffset = this.$el.offsetTop
const windowOffset = document.documentElement.scrollTop || document.body.scrollTop
const scrollArea = imageHeight - containerHeight
const scrollTopStartPoint = containerOffset - windowHeight
const scrollTopEndPoint = containerOffset + containerHeight

this.top = -scrollArea * (windowOffset - scrollTopStartPoint) / (scrollTopEndPoint - scrollTopStartPoint)
```

However, there could be cases that the container top position is less than window size, or the container bottom position till page end is less than window size. In this case the edge points should be page top or page bottom:

```
const scrollTopStartPoint = Math.max(containerOffset - windowHeight, 0)
const scrollTopEndPoint = Math.min(containerOffset + containerHeight, documentHeight - windowHeight)
```

Now we can see the full parallax effect!

## Performance considerations

To make the scroll effect smoother, we can use `window.requestAnimationFrame` to achieve. According to the [MDN page](https://developer.mozilla.org/en-US/docs/Web/Events/scroll) we can implement it as follows:

```
if (!this.ticking) {
  window.requestAnimationFrame(() => {
    this.updatePosition()
    this.ticking = false
  });
}
this.ticking = true
```

To support more browsers, we need search for different `requestAnimationFrame` and apply it to `window` object. If the browser does not support, we can give it a 60HZ refresh rate:

```
const defaultRequestAnimationFrame = f => setTimeout(f, 1000 / 60)

window.requestAnimationFrame = window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  defaultRequestAnimationFrame
```

## Code & Result

We can create a Vue component for parallax so that we can reuse it in multiple places. The other display content can be put in `<slot></slot>`. It should be able to get image url and image alt from props:

```
<div class="parallax-container">
  <div class="section">
    <slot></slot>
  </div>
  <div class="parallax">
    <img :src="getImgUrl(imageSrc)" :alt="imageAlt" :style="{ top: `${top}px` }">
  </div>
</div>
```

The complete code can be found [here](https://github.com/xuhaiming/xuhaiming.github.io/blob/master/src/components/scroll-parallax.vue). And the result is applied on home page.
