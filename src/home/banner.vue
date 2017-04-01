<template>
  <div class="parallax-container banner">
    <div class="section no-pad-bot vertical-center">
      <div class="container">
        <div class="row center" id="scene">
          <div data-depth="0.60" class="layer">
            <h3 class="title header center grey-text text-lighten-2">Welcome to Haiming Pages</h3>
          </div>
          <div data-depth="0.45" class="layer">
            <h5 class="description header center col s12 light">This is Haiming Xu's personal homepage using Vue JS 2.0 and Materialize CSS hosted on Github Pages.</h5>
          </div>
          <div data-depth="0.50" class="layer view-github_container">
            <h5 class="view-github header center col s12 light" @click="openGithub">View on Github</h5>  
          </div>
        </div>
      </div>
    </div>
    <div class="parallax"><img src="../assets/banner-1.jpg" alt="Unsplashed background img 1"></div>
  </div>
</template>

<script>
import Parallax from '../libs/parallax'

export default {
  mounted() {
    const scene = document.getElementById('scene')
    new Parallax(scene, {
      calibrateX: true,
      calibrateY: true,
      invertX: false,
      invertY: false,
      limitX: false,
      limitY: false,
      scalarX: 10,
      scalarY: 130,
      frictionX: 0.2,
      frictionY: 0.2,
      originX: 0.5,
      originY: 0.5
    });
  },
  methods: {
    openGithub() {
      window.open('https://github.com/xuhaiming/xuhaiming.github.io', '_blank')
    }
  }
}
</script>

<style>
@import '../styles/core.css';

.banner {
  & .title {
    position: relative;
    top: -50px;
    font-size: 2rem;

    @media (width > 992px) {
      font-size: 2.5rem;
    }
  }

  & .description {
    font-size: 1.3rem;

    @media (width > 992px) {
      font-size: 1.5rem;
    }
  }

  & .view-github {
    position: relative;
    top: 50px;
    font-weight: bold;
    cursor: pointer;
    font-size: 1.5rem;

    @media (width > 992px) {
      font-size: 1.7rem;
    }

    &_container {
      width: 100%;
    }
  }
}
</style>
