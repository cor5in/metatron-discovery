<img title="logo-metatron" src="https://user-images.githubusercontent.com/6300003/44013820-f7647c96-9f02-11e8-8066-1c97f8b1662c.png" alt="metatron-discovery-logo" width="400px">

------------------

**Metatron Discovery** is an end-to-end big data self discovery solution.
To learn more about it, visit our [web site](https://www.metatron.app). Check [our blog](https://www.metatron.app/index.php/blog/) for upcoming events and development news. Also if you got stuck when using Metatron Discovery, please leave your problem on our [user forum](https://groups.google.com/forum/#!forum/metatron-discovery).


Strengths
------------------

- Able to process HUGE data sets super FAST, powered by (optimized) [Apache Druid](http://druid.io/).
- Single solution for data analytics from easy data preparation to fast visualization.
- Easy data analytics for everyone.


Key Features
------------------

Metatron provides:
- Interactive dashboards with numerous preloaded charts.
- Query(SQL) based data exploration and GUI based data wrangling.
- Various data source connections (e.g. DBs, HIVE, or Kafka streams).
- Geo data analysis with geospatial operations.
- Job and data usage monitoring.
- Metadata management.
- 3rd party data analytics tool integration(e.g. [Apache Zeppelin](https://zeppelin.apache.org/)).
- Fine grain access control of users and workspaces.
- Overcomes Druid weaknesses(e.g. no data join function) without performance degradation using [Metatron optimized Druid](https://www.metatron.app/index.php/2018/06/15/skt-druid-features/).
- Full API support, enabling easy integration into your environment/software.
- Multiple languages according to browser setting(Currently supporting English, Korean, Chinese).
- Available on AWS, Azure('19.3Q).
- Docker support for distributed version deploy('19.3Q).
- Monitoring Metatron engine performance('19.3Q).

Screenshots
------------------
### Create Dashboards
<kbd><img title="Metatron-dashboard" src="https://user-images.githubusercontent.com/8841220/56104113-598f0880-5f71-11e9-8dbc-930703fe9b92.png"></kbd><br />

### Create Charts
<kbd><img title="Metatron-chart" src="https://user-images.githubusercontent.com/6300003/44201180-98bb4e80-a183-11e8-81da-54dd59d14330.png"></kbd><br />

### Analyze with Geospatial Data
<kbd><img title="Metatron-Geospatial-analysis" src="https://user-images.githubusercontent.com/8841220/55847737-641e5c00-5b85-11e9-84ed-ea1194c3710a.png"></kbd><br />

### Use Datasources
<kbd><img title="Use-datasource" src="https://user-images.githubusercontent.com/6300003/44200744-51808e00-a182-11e8-8fc6-d30d56b4ab26.png"></kbd><br />

### Manage Datasources
<kbd><img title="Datasource-detail" src="https://user-images.githubusercontent.com/6300003/44200028-95729380-a180-11e8-95fb-070d7ed0d260.png"></kbd><br />

### Manage Engine Performance (Coming Soon)
<kbd><img title="Metatron-engine-monitoring" src="https://user-images.githubusercontent.com/6300003/53152270-73a70d00-35f8-11e9-8412-096e6099adab.png"></kbd><br />

### Connect Database
<kbd><img title="Create-connection" src="https://user-images.githubusercontent.com/6300003/44200666-1bdba500-a182-11e8-8b2b-43dfdfe30bf4.png"></kbd><br />

### Prepare Origin Data
<kbd><img title="Data-preparation" src="https://user-images.githubusercontent.com/8841220/53787835-688e9e00-3f63-11e9-94db-078dc5add109.png"></kbd><br />

### Query Monitoring
<kbd><img title="query-monitoring" src="https://www.metatron.app/wp-content/uploads/2018/10/screencapture-discovery-metatron-app-app-v2-management-monitoring-statistics-2018-10-29-15_38_15-1.png"><br /></kbd>

### SQL in Druid
<kbd><img title="query-monitoring" src="https://user-images.githubusercontent.com/8841220/53787073-f917af00-3f60-11e9-9e11-a9dfe82a99da.png"><br /></kbd>

Installation
----------------------------

### [Guide Video](https://www.youtube.com/watch?v=wVpgnHgzDOk)
- Only the Korean description is available for now.

### Requirements
- MacOS / Linux (Redhat, CentOS)
- JDK 1.8
- **Druid customized version for Metatron**
  - [Here is the link for downloading the archive.](https://drive.google.com/file/d/1q_iL574KOQFTDbAVqpKOrDUiAdW_x9yv/view?usp=sharing)
  - To install the Metatron distributed Druid, simply untar the downloaded archive. And start | stop the druid with the following commands.
  <pre><code> $ start-single.sh | stop-single.sh </code></pre>
- (Optional) Apache Maven 3.3+ for building the project

### Install Metatron Discovery
There is two way to get the running binary file.

- Directly download the final binary file from [this link](https://drive.google.com/file/d/1-zoeIC90xYWobvJoj94fw4_eX0bLWzUF/view?usp=sharing)
- Or, build source code from this repository as shown below:
  - Clone this project.
  <pre><code>$ git clone https://github.com/metatron-app/metatron-discovery.git</code></pre>
  - Build through Maven 3.3+.
  <pre><code>$ mvn clean install -DskipTests</code></pre>
  Building the whole project takes some time especially for the "discovery-frontend". Please wait a few minutes.
  
  If the build succeeds, you can find an archive file under "discovery-distribution/target"

### Start up the Metatron Discovery
Untar the archive binary file of Metatron Discovery.
<pre><code>$ tar zxf metatron-discovery-{VERSION}-{TIMESTAMP}-bin.tar.gz</code></pre>

#### Configuration (optional)
Metatron Discovery loads its configuration from the files under “/conf” directory by default. We already wrote some frequent configurations in the template files. For your own configuration of Metatron Discovery application, you should create a new configuration file with reference to the pre-distributed template file as belows. In the generated setting file, refer to [the configuration guide](https://github.com/metatron-app/metatron-discovery/blob/master/discovery-server/src/main/asciidoc/application-config-guide.adoc) and specify detailed setting information.

<pre><code>$ cp ./conf/application-config.templete.yaml ./conf/application-config.yaml</code></pre>

To configure the environment in which the server is running, you need to configure server memory or classpath settings by editing the “metatron-env.sh” file.

<pre><code>$ cp ./conf/metatron-env.sh.templete ./conf/metatron-env.sh</code></pre>

For example, if you want to use MySQL and increase the memory, you should set it as below. See the comments in the file “metatron-env.sh.templete” for more information.
```
export METATRON_JAVA_OPTS=-Xms4g -Xmx4g
export METATRON_DB_TYPE=mysql
```

#### Run Metatron Discovery
Run with the following command.
<pre><code>$ bin/metatron.sh start</code></pre>

Running options are provided as well.
<pre><code>$ bin/metatron.sh [--config=directory] [--management] [--debug=port] {start|stop|restart|status}</code></pre>
To access Metatron Discovery, go to [http://localhost:8180](http://localhost:8180). (The default admin user account is provided as Username: admin, PW: admin.)

### Using REST API
Metatron support RESTful APIs. Please refer to the following details [how to using the REST API](.github/USE_REST_API.md)

### Dockerize Metatron Discovery
After completing the build, you can create a docker image.
<pre><code>$ cd discovery-distribution
$ docker build -t {image name}:{image tag} -f docker/Dockerfile
</code></pre>

:exclamation: Note that there must be only one package in the target directory.

Problems & Suggestions
----------------------------
This project welcomes contributions and suggestions. If you encounter any bugs or want to request new features, feel free to open an [GitHub Issue](https://github.com/metatron-app/metatron-discovery/issues) in the repo so that the community can find resolutions for it. Or reports bug to our [discussion forum](https://www.metatron.app/discussion/). Although, please check before you raise an issue. That is please make sure someone else hasn’t already created an issue for the same topic.

Question
----------------------------
Need help using Metatron Discovery? Check our [FAQs](https://www.metatron.app/discussion) or ask away on our [discussion forum](https://groups.google.com/d/forum/metatron-discovery)! Our fellow community members will be glad to help you out! Or you can check out our [user manual on our website](https://www.metatron.app/docs) as well.

License
----------------------------
Metatron Discovery is available under the Apache License V2.
