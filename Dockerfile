FROM node:8.11
RUN apt-get update && apt-get install -y software-properties-common vim
RUN apt-get update \
  && apt-get install -y python3-pip python3-dev \
  && cd /usr/local/bin \
  && ln -s /usr/bin/python3 python \
  && pip3 install --upgrade pip
RUN apt-get update && apt-get install -y git
RUN apt-get update && apt-get install -y libvtkgdcm-tools
RUN apt-get update && apt-get install -y libgdcm-tools
RUN pip install keras
RUN pip install tensorflow
RUN pip install pillow
RUN pip install scikit-image
RUN pip install flask
RUN pip install h5py
RUN pip install sklearn

WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
CMD ./start_app.sh
EXPOSE 3001
