class Header extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/";
        baseUrl = getUrl.host === "xuhaiming.github.io" ? baseUrl : baseUrl + getUrl.pathname.split('/')[1];
        var isOnMainPage = this.props.isOnMainPage;
        var urlBaseString = isOnMainPage ? "" : baseUrl;

        return (
            <div id="header">

                <div className="top">

                    <div id="logo">
                        <span className="image avatar48"><img src={baseUrl + "/images/avatar.jpg"} alt=""/></span>

                        <h1 id="title">Xu Haiming</h1>

                        <p>Software Engineer</p>
                    </div>

                    <nav id="nav">
                        <ul>
                            <li><a href={urlBaseString + "#intro"} id="intro-link" className="skel-layers-ignoreHref"><span
                                className="icon fa-home">Intro</span></a></li>
                            <li><a href={urlBaseString + "#blogs"} id="blogs-link" className={isOnMainPage ? "skel-layers-ignoreHref" : "skel-layers-ignoreHref active"}><span
                                className="icon fa-th">Blogs</span></a></li>
                            <li><a href={urlBaseString + "#about"} id="about-link" className="skel-layers-ignoreHref"><span
                                className="icon fa-user">About Me</span></a></li>
                            <li><a href={urlBaseString + "#contact"} id="contact-link" className="skel-layers-ignoreHref"><span
                                className="icon fa-envelope">Contact</span></a></li>
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
        )
    }
}