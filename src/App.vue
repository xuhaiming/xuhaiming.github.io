<template>
  <div id="app">
    <nav class="white" role="navigation">
      <div class="nav-wrapper container">
        <a id="logo-container" href="#" class="brand-logo grey-text text-darken-3">Haiming Pages</a>

        <ul id="nav-mobile" class="side-nav">
          <li><a href="#">Navigation</a></li>
        </ul>
        <a href="#" data-activates="nav-mobile" class="button-collapse"><i class="material-icons">Icon</i></a>
      </div>
    </nav>

    <div id="index-banner" class="parallax-container valign-wrapper">
      <div id="index-banner-section" class="section no-pad-bot hidden">
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
        <h4 id="post-title" class="center hidden">Posts</h4>
        <ul id="post-list" class="row">
          <li class="col s12 m4">
            <div class="card hoverable">
              <div class="card-image">
                <img src="./assets/banner-1.jpg">
                <span class="card-title">Card Title</span>
              </div>
              <div class="card-content">
                <p>I am a very simple card. I am good at containing small bits of information.
                I am convenient because I require little markup to use effectively.</p>
              </div>
            </div>
          </li>

          <li class="col s12 m4">
            <div class="card hoverable">
              <div class="card-image">
                <img src="./assets/banner-2.jpg">
                <span class="card-title">Card Title</span>
              </div>
              <div class="card-content">
                <p>I am a very simple card. I am good at containing small bits of information.
                I am convenient because I require little markup to use effectively.</p>
              </div>
            </div>
          </li>

          <li class="col s12 m4">
            <div class="card hoverable">
              <div class="card-image">
                <img src="./assets/banner-3.jpg">
                <span class="card-title">Card Title</span>
              </div>
              <div class="card-content">
                <p>I am a very simple card. I am good at containing small bits of information.
                I am convenient because I require little markup to use effectively.</p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>


    <div id="middle-container" class="parallax-container valign-wrapper">
      <div id="middle-section" class="section no-pad-bot hidden">
        <div class="container">
          <div class="row center">
            <h5 class="header col s12 light">Develop native or web applications across various of platforms</h5>
          </div>
        </div>
      </div>
      <div class="parallax"><img src="./assets/banner-2.jpg" alt="Unsplashed background img 2"></div>
    </div>

    <div id="about-me" class="container">
      <div id="about-me-section" class="section hidden">
        <div class="row">
          <div class="col s12 center">
            <h4>About Me</h4>
            <p class="left-align light">I am a software engineer who is currently specialized on web development. It is great to work with the latest Node JS features and experience frameworks such as Vue JS or React JS. Besides of Javascript, C# is another one of my most favourite programming languages. I have been developing ASP .NET applications and Windows UWP apps on Azure platform for few years, which are also quite interesting. It is a pity that I did not have many chances to deep into the virtual reality area after my graduation of university. It was really valuable experiences to work with all kinds of VR devices and hopefully I can do something fancy with them someday in the future.</p>
          </div>
        </div>
      </div>
    </div>


    <div id="bottom-container" class="parallax-container valign-wrapper">
      <div id="bottom-section" class="section no-pad-bot hidden">
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

    $('#index-banner-section').fadeIn('slow')
    $('#post-title').fadeIn('slow')
    Materialize.showStaggeredList($('#post-list'))

    var options = [{
      selector: '#middle-container', offset: 350, callback(el) {
        $('#middle-section').fadeIn('slow')
      }
    }, {
      selector: '#about-me', offset: 200, callback(el) {
        $('#about-me-section').fadeIn('slow')
      }
    }, {
      selector: '#bottom-container', offset: 350, callback(el) {
        $('#bottom-section').fadeIn('slow')
      }
    }]
    Materialize.scrollFire(options)
  }
}
</script>

<style>

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

.hidden {
  display: none;
}

#post-list > li {
  opacity: 0;
}

#about-me {
  min-height: 250px;
}

</style>
