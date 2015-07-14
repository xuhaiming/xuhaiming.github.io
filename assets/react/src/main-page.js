class MainPage extends React.Component {
    constructor() {
        super();
        this.state = {
            blog: {}
        };
        $.get( "http://haimingblogservice.azurewebsites.net/api/Posts", function( data ) {
            this.setState({blog: data.value[0]});
            console.log(data.value[0]);
        }.bind(this));
    }
    render() {
        return (
            <div>
                <div id="header">

                    <div className="top">

                        <div id="logo">
                            <span className="image avatar48"><img src="images/avatar.jpg" alt="" /></span>
                            <h1 id="title">Xu Haiming</h1>
                            <p>Software Engineer</p>
                        </div>

                        <nav id="nav">
                            <ul>
                                <li><a href="#top" id="top-link" className="skel-layers-ignoreHref"><span className="icon fa-home">Intro</span></a></li>
                                <li><a href="#blogs" id="blogs-link" className="skel-layers-ignoreHref"><span className="icon fa-th">Blogs</span></a></li>
                                <li><a href="#about" id="about-link" className="skel-layers-ignoreHref"><span className="icon fa-user">About Me</span></a></li>
                                <li><a href="#contact" id="contact-link" className="skel-layers-ignoreHref"><span className="icon fa-envelope">Contact</span></a></li>
                            </ul>
                        </nav>

                    </div>

                    <div className="bottom">

                        <ul className="icons">
                            <li><a href="#" className="icon fa-twitter"><span className="label">Twitter</span></a></li>
                            <li><a href="#" className="icon fa-facebook"><span className="label">Facebook</span></a></li>
                            <li><a href="#" className="icon fa-github"><span className="label">Github</span></a></li>
                            <li><a href="#" className="icon fa-dribbble"><span className="label">Dribbble</span></a></li>
                            <li><a href="#" className="icon fa-envelope"><span className="label">Email</span></a></li>
                        </ul>

                    </div>

                </div>

                <div id="main">

                    <section id="top" className="one dark cover">
                        <div className="container">

                            <header>
                                <h2 className="alt">This is my amazing blog page</h2>
                                <p>It is super super super beautiful</p>
                            </header>

                            <footer>
                                <a href="#portfolio" className="button scrolly">A Useless Button</a>
                            </footer>

                        </div>
                    </section>

                    <section id="blogs" className="two">
                        <div className="container">

                            <header>
                                <h2>Blogs</h2>
                            </header>

                            <p>Vitae natoque dictum etiam semper magnis enim feugiat convallis convallis
                                egestas rhoncus ridiculus in quis risus amet curabitur tempor orci penatibus.
                                Tellus erat mauris ipsum fermentum etiam vivamus eget. Nunc nibh morbi quis
                                fusce hendrerit lacus ridiculus.</p>

                            <div className="row">
                                <div className="4u 12u$(mobile)">
                                    <article className="item">
                                        <a href="#" className="image fit"><img src={"images/pic0" + this.state.blog.Id + ".jpg"} alt="" /></a>
                                        <header>
                                            <h3>{this.state.blog.Title}</h3>
                                        </header>
                                    </article>
                                    <article className="item">
                                        <a href="#" className="image fit"><img src="images/pic03.jpg" alt="" /></a>
                                        <header>
                                            <h3>Rhoncus Semper</h3>
                                        </header>
                                    </article>
                                </div>
                                <div className="4u 12u$(mobile)">
                                    <article className="item">
                                        <a href="#" className="image fit"><img src="images/pic04.jpg" alt="" /></a>
                                        <header>
                                            <h3>Magna Nullam</h3>
                                        </header>
                                    </article>
                                    <article className="item">
                                        <a href="#" className="image fit"><img src="images/pic05.jpg" alt="" /></a>
                                        <header>
                                            <h3>Natoque Vitae</h3>
                                        </header>
                                    </article>
                                </div>
                                <div className="4u$ 12u$(mobile)">
                                    <article className="item">
                                        <a href="#" className="image fit"><img src="images/pic06.jpg" alt="" /></a>
                                        <header>
                                            <h3>Dolor Penatibus</h3>
                                        </header>
                                    </article>
                                    <article className="item">
                                        <a href="#" className="image fit"><img src="images/pic07.jpg" alt="" /></a>
                                        <header>
                                            <h3>Orci Convallis</h3>
                                        </header>
                                    </article>
                                </div>
                            </div>

                        </div>
                    </section>

                    <section id="about" className="three">
                        <div className="container">

                            <header>
                                <h2>About Me</h2>
                            </header>

                            <a href="#" className="image featured"><img src="images/pic08.jpg" alt="" /></a>

                            <p>Tincidunt eu elit diam magnis pretium accumsan etiam id urna. Ridiculus
                                ultricies curae quis et rhoncus velit. Lobortis elementum aliquet nec vitae
                                laoreet eget cubilia quam non etiam odio tincidunt montes. Elementum sem
                                parturient nulla quam placerat viverra mauris non cum elit tempus ullamcorper
                                dolor. Libero rutrum ut lacinia donec curae mus vel quisque sociis nec
                                ornare iaculis.</p>

                        </div>
                    </section>

                    <section id="contact" className="four">
                        <div className="container">

                            <header>
                                <h2>Contact</h2>
                            </header>

                            <p>You can contact me by filling the information in the form below and
                                click the "Send Message" button. But finally you will find nothing happens.</p>

                            <form method="post" action="#">
                                <div className="row">
                                    <div className="6u 12u$(mobile)"><input type="text" name="name" placeholder="Name" /></div>
                                    <div className="6u$ 12u$(mobile)"><input type="text" name="email" placeholder="Email" /></div>
                                    <div className="12u$">
                                        <textarea name="message" placeholder="Message"></textarea>
                                    </div>
                                    <div className="12u$">
                                        <input type="submit" value="Send Message" />
                                    </div>
                                </div>
                            </form>

                        </div>
                    </section>

                </div>

                <div id="footer">

                    <ul className="copyright">
                        <li>&copy; Xu Haiming. All rights reserved.</li><li>2015</li>
                    </ul>

                </div>
            </div>
        );
    }
}

React.render(<MainPage />, document.getElementById('main-page'));