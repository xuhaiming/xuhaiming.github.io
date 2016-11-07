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
            <h5 class="header col s12 light">This is Haiming Xu's personal homepage using Vue JS 2.0 and Materialize CSS hosted on Github Pages.</h5>
            <a class="waves-effect waves-light btn-large teal darken-1 view-github" target="_blank" href="https://github.com/xuhaiming/xuhaiming.github.io">View on Github</a>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-1.jpg" alt="Unsplashed background img 1"></div>
    </div>

    <div class="container">
      <div class="section">
        <h4 class="center">Posts</h4>
      </div>
    </div>


    <div class="parallax-container valign-wrapper">
      <div class="section no-pad-bot">
        <div class="container">
          <div class="row center">
            <h5 class="header col s12 light">Develop native or web applications across various of platforms</h5>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-2.jpg" alt="Unsplashed background img 2"></div>
    </div>

    <div class="container">
      <div class="section">

        <div class="row">
          <div class="col s12 center">
            <h4>About Me</h4>
            <p class="left-align light">I am a software engineer who is currently specialized on web development. It is great to work with the latest Node JS features and experience frameworks such as Vue JS or React JS. Besides of Javascript, C# is another one of my most favourite programming languages. I have been developing ASP .NET applications and Windows UWP apps on Azure platform for few years, which are also quite interesting. It is a pity that I did not have many chances to deep into the virtual reality area after my graduation of university. It was really valuable experiences to work with all kinds of VR devices and hopefully I can do something fancy with them someday in the future.</p>
          </div>
        </div>

      </div>
    </div>


    <div class="parallax-container valign-wrapper">
      <div class="section no-pad-bot">
        <div class="container">
          <div class="row center">
            <h5 class="header col s12 light">Make something amazing with Virtual Reality.</h5>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-3.jpg" alt="Unsplashed background img 3"></div>
    </div>

    <footer class="page-footer grey darken-4">
      <div class="container">
        <div class="row">
          <div class="col l3 s12">
            <h5 class="white-text">Contacts</h5>
            <ul>
              <li><a class="white-text" target="_blank" href="mailto:haiming12322@qq.com">Email</a></li>
              <li><a class="white-text" target="_blank" href="https://github.com/xuhaiming">Github</a></li>
              <li><a class="white-text" target="_blank" href="https://www.linkedin.com/in/xu-haiming-48502869">LinkedIn</a></li>
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

.view-github {
  margin-top: 2em;
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
