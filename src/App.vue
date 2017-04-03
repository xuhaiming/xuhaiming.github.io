<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: 'app'
}
</script>

<style>
h2 {
  font-size: 1rem;
  font-weight: bold;
}

p {
  line-height: 2rem;
}

.button-collapse {
  color: #26a69a;
}

.view-github {
  margin-top: 2em;
}

.vertical-center {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.fade-enter-active,
.fade-leave-active {
  transition: all .8s;
}

.fade-enter,
.fade-leave-active {
  opacity: 0;
  transform: translateY(15px);
}
</style>
