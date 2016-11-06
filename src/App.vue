<template>
  <div id="app">
    <nav class="white" role="navigation">
      <div class="nav-wrapper container">
        <a id="logo-container" href="#" class="brand-logo">Haiming Pages</a>
        <ul class="right hide-on-med-and-down">
          <li><a class="waves-effect waves-light" href="#">Posts</a></li>
        </ul>

        <ul id="nav-mobile" class="side-nav">
          <li><a href="#">Navigation</a></li>
        </ul>
        <a href="#" data-activates="nav-mobile" class="button-collapse"><i class="material-icons">Icon</i></a>
      </div>
    </nav>

    <div id="index-banner" class="parallax-container valign-wrapper">
      <div class="section no-pad-bot">
        <div class="container">
          <div class="row center">
            <h3 class="header center grey-text text-lighten-2">Welcome to Haiming Pages</h3>
            <br><br>
            <h5 class="header col s12 light">This is Haiming Xu's personal homepage using Vue JS 2.0 and Materialize CSS hosted on Github Pages.</h5>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-1.jpg" alt="Unsplashed background img 1"></div>
    </div>

    <div class="container">
      <div class="section">

        <div class="row">
          <div class="col s12 l4">
            <div class="icon-block">
              <h5 class="center">Web Development</h5>

              <p class="light">Since ECMA Script 2015 and Node JS 7.0 released, Javascript has became to one of the most powerful programming language. Great frameworks such as React JS and Vue JS with Webpack make this world more beautiful.</p>
            </div>
          </div>

          <div class="col s12 l4">
            <div class="icon-block">
              <h5 class="center">.NET Platforms</h5>

              <p class="light">By utilizing elements and principles of Material Design, we were able to create a framework that incorporates components and animations that provide more feedback to users. Additionally, a single underlying responsive system across all platforms allow for a more unified user experience.</p>
            </div>
          </div>

          <div class="col s12 l4">
            <div class="icon-block">
              <h5 class="center">Virtual Reality</h5>

              <p class="light">We have provided detailed documentation as well as specific code examples to help new users get started. We are also always open to feedback and can answer any questions a user may have about Materialize.</p>
            </div>
          </div>
        </div>

      </div>
    </div>


    <div class="parallax-container valign-wrapper">
      <div class="section no-pad-bot">
        <div class="container">
          <div class="row center">
            <h5 class="header col s12 light">Develop native or web application across various of platforms</h5>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-2.jpg" alt="Unsplashed background img 2"></div>
    </div>

    <div class="container">
      <div class="section">

        <div class="row">
          <div class="col s12 center">
            <h3><i class="mdi-content-send brown-text"></i></h3>
            <h4>About Me</h4>
            <p class="left-align light">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque id nunc nec volutpat. Etiam pellentesque tristique arcu, non consequat magna fermentum ac. Cras ut ultricies eros. Maecenas eros justo, ullamcorper a sapien id, viverra ultrices eros. Morbi sem neque, posuere et pretium eget, bibendum sollicitudin lacus. Aliquam eleifend sollicitudin diam, eu mattis nisl maximus sed. Nulla imperdiet semper molestie. Morbi massa odio, condimentum sed ipsum ac, gravida ultrices erat. Nullam eget dignissim mauris, non tristique erat. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;</p>
          </div>
        </div>

      </div>
    </div>


    <div class="parallax-container valign-wrapper">
      <div class="section no-pad-bot">
        <div class="container">
          <div class="row center">
            <h5 class="header col s12 light">A modern responsive front-end framework based on Material Design</h5>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-1.jpg" alt="Unsplashed background img 3"></div>
    </div>

    <footer class="page-footer grey darken-4">
      <div class="container">
        <div class="row">
          <div class="col l3 s12">
            <h5 class="white-text">Contacts</h5>
            <ul>
              <li><a class="white-text" href="mailto:haiming12322@qq.com">Email</a></li>
              <li><a class="white-text" href="https://github.com/xuhaiming">Github</a></li>
              <li><a class="white-text" href="https://www.linkedin.com/in/xu-haiming-48502869">LinkedIn</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="footer-copyright">
        <div class="container">
          Powered by <a class="brown-text text-lighten-3" href="https://github.com/xuhaiming/xuhaiming.github.io">Xu Haiming</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'app',
  data() {
    return {
      msg: 'Welcome to Your Vue.js App'
    }
  },
  mounted() {
    $('.button-collapse').sideNav()
    $('.parallax').parallax()
  }
}
</script>

<style>

nav ul a,
nav .brand-logo {
  color: #444;
}

p {
  line-height: 2rem;
}

.button-collapse {
  color: #26a69a;
}

.parallax-container {
  min-height: 550px;
  line-height: 0;
  height: auto;
  color: rgba(255,255,255,.9);
  width: 100%;

  & .section {
    width: 100%;
  }
}

footer.page-footer {
  margin: 0;
}

</style>
